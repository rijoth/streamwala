import { PlayerEngine, HlsPlayerEngine, MpegtsPlayerEngine, NativePlayerEngine, PlayerStats } from './PlayerEngine.ts';
import {
  applyProxyTemplate,
  planTransports,
  type PlaybackTransport,
} from '../../domain/transport.ts';
import { knownTransport, rememberTransport } from '../net/transportMemory.ts';

export type PreferredEngine = 'auto' | 'hls' | 'mpegts' | 'native';

export interface PlayerManagerOptions {
  preferredEngine?: PreferredEngine;
  proxyUrlTemplate?: string;
  onStateChange?: (state: PlayerManagerState) => void;
}

export interface PlayerManagerState {
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
  currentEngine: 'hls' | 'mpegts' | 'native' | null;
  /**
   * Transport in use for the current attempt. `proxied` means the CORS proxy
   * configured in Settings; `direct` means the stream origin itself. On a
   * terminal error this is the last transport tried, which is what the error
   * overlay uses to explain that the proxy was reached and also failed.
   */
  transport: PlaybackTransport;
  error: string | null;
  isBuffering: boolean;
  stats: PlayerStats | null;
  retryCount: number;
  engineIndex: number;
  totalEngines: number;
  isMixedContent: boolean;
  isCorsRisk: boolean;
}

export class PlayerManager {
  private engine: PlayerEngine | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private rawStreamUrl: string = '';
  private options: PlayerManagerOptions;
  private engineOrder: ('hls' | 'mpegts' | 'native')[] = [];
  /** Ordered transports for the current stream, e.g. `['direct', 'proxied']`. */
  private transports: PlaybackTransport[] = ['direct'];
  private transportIndex = 0;
  private currentEngineIndex = 0;
  private isPlaybackStarted = false;
  private retryCount = 0;
  private maxRetries = 2;
  private retryTimeout: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;
  /**
   * Incremented whenever a new stream/engine session starts. Async engine
   * callbacks capture this value and no-op if the session has changed, so a
   * slow init from a previous channel cannot update state for the new one.
   */
  private generation = 0;

  public state: PlayerManagerState = {
    status: 'idle',
    currentEngine: null,
    transport: 'direct',
    error: null,
    isBuffering: false,
    stats: null,
    retryCount: 0,
    engineIndex: 0,
    totalEngines: 0,
    isMixedContent: false,
    isCorsRisk: false,
  };

  constructor(options: PlayerManagerOptions = {}) {
    this.options = options;
  }

  private updateState(partial: Partial<PlayerManagerState>) {
    this.state = { ...this.state, ...partial };
    this.options.onStateChange?.(this.state);
  }

  async loadStream(videoEl: HTMLVideoElement, streamUrl: string) {
    this.destroy();
    this.generation += 1;
    this.videoEl = videoEl;
    this.rawStreamUrl = streamUrl.trim();
    this.retryCount = 0;
    this.isPlaybackStarted = false;

    this.engineOrder = this.getEngineOrder(this.rawStreamUrl);
    this.transports = planTransports({
      streamUrl: this.rawStreamUrl,
      proxyTemplate: this.options.proxyUrlTemplate,
      pageProtocol: window.location.protocol,
      remembered: knownTransport(this.rawStreamUrl),
    });
    this.transportIndex = 0;
    this.currentEngineIndex = 0;

    await this.attemptEngineAtIndex(this.currentEngineIndex);
  }

  private currentTransport(): PlaybackTransport {
    return this.transports[this.transportIndex] ?? 'direct';
  }

  /** The URL the current transport must fetch: the origin, or it via the proxy. */
  private transportUrl(transport: PlaybackTransport): string {
    if (transport === 'proxied' && this.options.proxyUrlTemplate) {
      return applyProxyTemplate(this.options.proxyUrlTemplate, this.rawStreamUrl) ?? this.rawStreamUrl;
    }
    return this.rawStreamUrl;
  }

  private async attemptEngineAtIndex(index: number) {
    if (!this.videoEl || !this.rawStreamUrl) return;

    if (index >= this.engineOrder.length) {
      this.handleAllEnginesFailed('All player engines failed to play this stream.');
      return;
    }

    this.currentEngineIndex = index;
    const gen = this.generation;
    const engineType = this.engineOrder[index];
    const transport = this.currentTransport();
    const resolvedUrl = this.transportUrl(transport);
    // Sub-request proxying (fragments, keys, playlists) is only correct when
    // this attempt actually goes through the proxy.
    const engineProxyTemplate = transport === 'proxied' ? this.options.proxyUrlTemplate : undefined;

    const isMixedContent =
      window.location.protocol === 'https:' &&
      this.rawStreamUrl.startsWith('http://') &&
      !this.options.proxyUrlTemplate;

    this.updateState({
      status: 'loading',
      isBuffering: true,
      currentEngine: engineType,
      transport,
      error: null,
      engineIndex: this.transportIndex * this.engineOrder.length + index + 1,
      totalEngines: this.transports.length * this.engineOrder.length,
      isMixedContent,
      isCorsRisk: false,
    });

    try {
      if (this.engine) {
        this.engine.destroy();
        this.engine = null;
      }
      this.stopStatsLoop();

      this.engine = this.createEngine(engineType);

      await this.engine.init(
        this.videoEl,
        resolvedUrl,
        {
          onError: (errMsg, isFatal) => {
            if (gen !== this.generation) return;
            if (isFatal) {
              this.handleEngineFailure(errMsg, engineType, gen);
            }
          },
          onLoading: (isLoading) => {
            if (gen !== this.generation) return;
            this.updateState({ isBuffering: isLoading });
          },
          onStatsUpdate: (stats) => {
            if (gen !== this.generation) return;
            this.updateState({ stats });
          },
          onSuccess: () => {
            if (gen !== this.generation) return;
            this.isPlaybackStarted = true;
            this.updateState({ status: 'playing', isBuffering: false, error: null });
            this.rememberCurrentTransport();
            this.startStatsLoop();
          },
        },
        engineProxyTemplate
      );

      if (gen !== this.generation) return;
      this.startStatsLoop();
    } catch (err: unknown) {
      if (gen !== this.generation) return;
      console.warn(`Engine ${engineType} init failed:`, err);
      this.handleEngineFailure(err instanceof Error ? err.message : String(err), engineType, gen);
    }
  }

  private handleEngineFailure(
    errorMessage: string,
    failedEngine: 'hls' | 'mpegts' | 'native',
    gen: number
  ) {
    if (gen !== this.generation) return;
    console.warn(
      `Engine ${failedEngine} on ${this.currentTransport()} transport reported fatal error: ${errorMessage}`
    );

    if (this.isPlaybackStarted) {
      // Mid-stream glitch: reconnect on the same transport with bounded backoff
      // before considering the other transport.
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = Math.pow(2, this.retryCount) * 1000;
        this.updateState({
          status: 'error',
          error: `${errorMessage} (Reconnecting stream in ${delay / 1000}s, attempt ${this.retryCount}/${this.maxRetries})...`,
          retryCount: this.retryCount,
        });

        this.retryTimeout = setTimeout(() => {
          this.attemptEngineAtIndex(this.currentEngineIndex);
        }, delay);
        return;
      }
      this.attemptNextTransport();
      return;
    }

    // Startup failure: try the next engine (format fallback) in this transport.
    if (this.currentEngineIndex + 1 < this.engineOrder.length) {
      const nextIndex = this.currentEngineIndex + 1;
      const nextEngine = this.engineOrder[nextIndex];
      console.info(`Falling back from ${failedEngine} to ${nextEngine}...`);
      this.attemptEngineAtIndex(nextIndex);
      return;
    }

    this.attemptNextTransport();
  }

  private rememberCurrentTransport() {
    rememberTransport(this.rawStreamUrl, this.currentTransport());
  }

  /**
   * Moves to the next planned transport (`direct` -> `proxied`) once every
   * engine on the current one has failed. The plan is finite, so this either
   * starts a working attempt or ends in `handleAllEnginesFailed`.
   */
  private attemptNextTransport() {
    const nextIndex = this.transportIndex + 1;
    if (nextIndex < this.transports.length) {
      this.transportIndex = nextIndex;
      console.info(`Retrying stream over the ${this.transports[nextIndex]} transport...`);
      this.attemptEngineAtIndex(0);
      return;
    }

    this.handleAllEnginesFailed('All player engines failed to play this stream.');
  }

  private handleAllEnginesFailed(errorMessage: string) {
    const isMixedContent =
      window.location.protocol === 'https:' &&
      this.rawStreamUrl.startsWith('http://') &&
      !this.options.proxyUrlTemplate;

    const lower = errorMessage.toLowerCase();
    const isCorsRisk =
      isMixedContent ||
      lower.includes('cors') ||
      lower.includes('access-control') ||
      lower.includes('network') ||
      lower.includes('fetch') ||
      lower.includes('code 2') ||
      lower.includes('failed to open media');

    this.updateState({
      status: 'error',
      error: errorMessage,
      isBuffering: false,
      isMixedContent,
      isCorsRisk,
    });
  }

  public async forceEngine(engineType: 'hls' | 'mpegts' | 'native') {
    this.generation += 1;
    this.engineOrder = [engineType];
    this.currentEngineIndex = 0;
    this.isPlaybackStarted = false;
    this.retryCount = 0;
    await this.attemptEngineAtIndex(0);
  }

  public async retryWithProxy(proxyTemplate: string) {
    this.generation += 1;
    this.options.proxyUrlTemplate = proxyTemplate;
    this.isPlaybackStarted = false;
    this.retryCount = 0;
    this.engineOrder = this.getEngineOrder(this.rawStreamUrl);
    this.transports = planTransports({
      streamUrl: this.rawStreamUrl,
      proxyTemplate,
      pageProtocol: window.location.protocol,
    });
    // The user explicitly asked for the proxy, so start there and keep the
    // remaining transports as the fallback.
    const proxiedIndex = this.transports.indexOf('proxied');
    this.transportIndex = proxiedIndex >= 0 ? proxiedIndex : 0;
    this.currentEngineIndex = 0;
    await this.attemptEngineAtIndex(0);
  }

  private getEngineOrder(url: string): ('hls' | 'mpegts' | 'native')[] {
    const pref = this.options.preferredEngine || 'auto';
    if (pref !== 'auto') {
      const rest = (['hls', 'mpegts', 'native'] as const).filter(e => e !== pref);
      return [pref, ...rest];
    }

    const lower = url.toLowerCase();
    if (lower.includes('.m3u8')) {
      return ['hls', 'native', 'mpegts'];
    }
    if (lower.includes('.ts') || lower.includes('/live/') || lower.includes('mpegts')) {
      return ['mpegts', 'hls', 'native'];
    }
    if (lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.mkv')) {
      return ['native', 'hls', 'mpegts'];
    }

    // Default for generic IPTV URLs (e.g. Xtream streams, PHP tokens):
    // Prioritize HLS and MPEG-TS over native because Chromium <video> cannot decode raw MPEG-TS
    return ['hls', 'mpegts', 'native'];
  }

  private createEngine(type: 'hls' | 'mpegts' | 'native'): PlayerEngine {
    switch (type) {
      case 'hls':
        return new HlsPlayerEngine();
      case 'mpegts':
        return new MpegtsPlayerEngine();
      case 'native':
        return new NativePlayerEngine();
    }
  }

  private startStatsLoop() {
    this.stopStatsLoop();
    this.statsInterval = setInterval(() => {
      if (this.engine) {
        const stats = this.engine.getStats();
        this.updateState({ stats });
      }
    }, 1500);
  }

  private stopStatsLoop() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  play() {
    this.engine?.play();
    this.updateState({ status: 'playing' });
  }

  pause() {
    this.engine?.pause();
    this.updateState({ status: 'paused' });
  }

  seek(time: number) {
    this.engine?.seek(time);
  }

  setVolume(volume: number) {
    this.engine?.setVolume(volume);
  }

  getAudioTracks() {
    return this.engine?.getAudioTracks() || [];
  }

  setAudioTrack(id: number) {
    this.engine?.setAudioTrack(id);
  }

  getSubtitleTracks() {
    return this.engine?.getSubtitleTracks() || [];
  }

  setSubtitleTrack(id: number) {
    this.engine?.setSubtitleTrack(id);
  }

  destroy() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.stopStatsLoop();
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
    this.videoEl = null;
    this.transports = ['direct'];
    this.transportIndex = 0;
    this.updateState({ status: 'idle', transport: 'direct', isBuffering: false, error: null });
  }
}
