import Hls from 'hls.js';
import mpegts from 'mpegts.js';

export interface PlayerStats {
  engine: 'hls' | 'mpegts' | 'native';
  bitrate?: number;
  resolution?: string;
  buffered?: number;
  droppedFrames?: number;
  videoWidth?: number;
  videoHeight?: number;
}

export interface TrackItem {
  id: number;
  name: string;
  lang?: string;
}

export interface PlayerEngineListener {
  onError: (error: string, isFatal: boolean) => void;
  onLoading: (isLoading: boolean) => void;
  onStatsUpdate: (stats: PlayerStats) => void;
  onSuccess?: () => void;
}

export interface PlayerEngine {
  init(videoEl: HTMLVideoElement, url: string, listener: PlayerEngineListener, proxyUrlTemplate?: string): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  destroy(): void;
  getStats(): PlayerStats;
  getAudioTracks(): TrackItem[];
  setAudioTrack(id: number): void;
  getSubtitleTracks(): TrackItem[];
  setSubtitleTrack(id: number): void;
}

/**
 * HLS Player Engine (HLS.js)
 */
export class HlsPlayerEngine implements PlayerEngine {
  private hls: Hls | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private listener: PlayerEngineListener | null = null;
  private onPlayingHandler: (() => void) | null = null;

  async init(
    videoEl: HTMLVideoElement,
    url: string,
    listener: PlayerEngineListener,
    proxyUrlTemplate?: string
  ): Promise<void> {
    this.videoEl = videoEl;
    this.listener = listener;

    if (!Hls.isSupported()) {
      throw new Error('HLS.js is not supported on this platform');
    }

    const config: Record<string, unknown> = {
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 30,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
    };

    if (proxyUrlTemplate && !proxyUrlTemplate.startsWith('data:') && !proxyUrlTemplate.startsWith('blob:')) {
      const template = proxyUrlTemplate;
      const proxyPrefix = template.split('{url}')[0];
      const DefaultLoader = Hls.DefaultConfig.loader;
      class ProxiedLoader extends (DefaultLoader as any) {
        load(context: any, conf: any, callbacks: any) {
          if (context && context.url && typeof context.url === 'string') {
            const originalUrl = context.url;
            if (
              !originalUrl.startsWith('data:') &&
              !originalUrl.startsWith('blob:') &&
              !originalUrl.startsWith(proxyPrefix)
            ) {
              context.url = template.replace('{url}', encodeURIComponent(originalUrl));
            }
          }
          super.load(context, conf, callbacks);
        }
      }
      config.loader = ProxiedLoader;
    }

    this.hls = new Hls(config as never);
    this.hls.attachMedia(videoEl);

    this.onPlayingHandler = () => {
      this.listener?.onLoading(false);
      this.listener?.onSuccess?.();
    };
    videoEl.addEventListener('playing', this.onPlayingHandler);

    this.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      this.hls?.loadSource(url);
    });

    this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
      this.listener?.onLoading(false);
      videoEl.play().catch(() => {
        videoEl.muted = true;
        videoEl.play().catch(e => console.warn('Autoplay prevented:', e));
      });
    });

    this.hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        const httpStatus = data.response?.code;
        const details = data.details || '';
        let message = `HLS Fatal error: ${details}`;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (httpStatus === 403) {
            message = 'HTTP 403 Forbidden: Stream link expired or unauthorized by provider';
          } else if (httpStatus === 404) {
            message = 'HTTP 404 Not Found: Stream segment or manifest missing';
          } else if (details.includes('manifestLoadError')) {
            message = `Failed to load HLS manifest (${httpStatus ? `HTTP ${httpStatus}` : 'CORS / Network restriction'})`;
          } else {
            message = `Network error loading stream segments (${details}${httpStatus ? ` HTTP ${httpStatus}` : ''})`;
          }
          this.listener?.onError(message, true);
          this.hls?.startLoad();
          return;
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          this.listener?.onError(`Media decode error (${details})`, true);
          this.hls?.recoverMediaError();
          return;
        }
        this.listener?.onError(message, true);
        this.destroy();
      }
    });
  }

  async play(): Promise<void> {
    if (this.videoEl) await this.videoEl.play();
  }

  pause(): void {
    if (this.videoEl) this.videoEl.pause();
  }

  seek(time: number): void {
    if (this.videoEl) this.videoEl.currentTime = time;
  }

  setVolume(volume: number): void {
    if (this.videoEl) this.videoEl.volume = Math.max(0, Math.min(1, volume));
  }

  destroy(): void {
    if (this.onPlayingHandler && this.videoEl) {
      this.videoEl.removeEventListener('playing', this.onPlayingHandler);
      this.onPlayingHandler = null;
    }
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.videoEl = null;
    this.listener = null;
  }

  getStats(): PlayerStats {
    let bitrate: number | undefined;
    if (this.hls && this.hls.currentLevel >= 0) {
      bitrate = this.hls.levels[this.hls.currentLevel]?.bitrate;
    }
    const width = this.videoEl?.videoWidth || 0;
    const height = this.videoEl?.videoHeight || 0;

    let buffered = 0;
    if (this.videoEl && this.videoEl.buffered.length > 0) {
      const cur = this.videoEl.currentTime || 0;
      const end = this.videoEl.buffered.end(this.videoEl.buffered.length - 1) || 0;
      const diff = end - cur;
      if (!Number.isNaN(diff) && Number.isFinite(diff)) {
        buffered = Math.max(0, Math.round(diff));
      }
    }

    return {
      engine: 'hls',
      bitrate: typeof bitrate === 'number' && !Number.isNaN(bitrate) ? bitrate : undefined,
      resolution: width > 0 ? `${width}x${height}` : undefined,
      videoWidth: width,
      videoHeight: height,
      buffered,
    };
  }

  getAudioTracks(): TrackItem[] {
    if (!this.hls) return [];
    return this.hls.audioTracks.map(t => ({ id: t.id, name: t.name, lang: t.lang }));
  }

  setAudioTrack(id: number): void {
    if (this.hls) this.hls.audioTrack = id;
  }

  getSubtitleTracks(): TrackItem[] {
    if (!this.hls) return [];
    return this.hls.subtitleTracks.map(t => ({ id: t.id, name: t.name, lang: t.lang }));
  }

  setSubtitleTrack(id: number): void {
    if (this.hls) this.hls.subtitleTrack = id;
  }
}

/**
 * MPEG-TS / FLV Player Engine (mpegts.js)
 */
export class MpegtsPlayerEngine implements PlayerEngine {
  private player: mpegts.Player | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private listener: PlayerEngineListener | null = null;
  private onPlayingHandler: (() => void) | null = null;

  async init(
    videoEl: HTMLVideoElement,
    url: string,
    listener: PlayerEngineListener
  ): Promise<void> {
    this.videoEl = videoEl;
    this.listener = listener;

    const features = mpegts.getFeatureList();
    if (!features.msePlayback) {
      throw new Error('MPEG-TS playback is not supported in this browser');
    }

    const isTs = url.includes('.ts') || url.includes('/live/') || !url.includes('.flv');
    this.player = mpegts.createPlayer({
      type: isTs ? 'mse' : 'flv',
      url,
      isLive: true,
    }, {
      enableWorker: true,
      lazyLoad: false,
      liveBufferLatencyChasing: true,
    });

    this.onPlayingHandler = () => {
      this.listener?.onLoading(false);
      this.listener?.onSuccess?.();
    };
    videoEl.addEventListener('playing', this.onPlayingHandler);

    this.player.attachMediaElement(videoEl);
    this.player.load();
    const playRes = this.player.play();
    if (playRes && typeof (playRes as Promise<void>).catch === 'function') {
      (playRes as Promise<void>).catch((e: unknown) => console.warn('mpegts play failed:', e));
    }

    this.player.on(mpegts.Events.ERROR, (types, details) => {
      this.listener?.onError(`MPEG-TS stream error: ${types} ${details}`, true);
    });
  }

  async play(): Promise<void> {
    if (this.player) {
      const res = this.player.play();
      if (res && typeof (res as Promise<void>).then === 'function') {
        await res;
      }
    }
  }

  pause(): void {
    if (this.player) this.player.pause();
  }

  seek(time: number): void {
    if (this.videoEl) this.videoEl.currentTime = time;
  }

  setVolume(volume: number): void {
    if (this.videoEl) this.videoEl.volume = Math.max(0, Math.min(1, volume));
  }

  destroy(): void {
    if (this.onPlayingHandler && this.videoEl) {
      this.videoEl.removeEventListener('playing', this.onPlayingHandler);
      this.onPlayingHandler = null;
    }
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    this.videoEl = null;
    this.listener = null;
  }

  getStats(): PlayerStats {
    const width = this.videoEl?.videoWidth || 0;
    const height = this.videoEl?.videoHeight || 0;
    return {
      engine: 'mpegts',
      resolution: width > 0 ? `${width}x${height}` : undefined,
      videoWidth: width,
      videoHeight: height,
    };
  }

  getAudioTracks(): TrackItem[] { return []; }
  setAudioTrack(): void {}
  getSubtitleTracks(): TrackItem[] { return []; }
  setSubtitleTrack(): void {}
}

/**
 * Native HTML5 Video Player Engine (Safari HLS / MP4 / WebM)
 */
export class NativePlayerEngine implements PlayerEngine {
  private videoEl: HTMLVideoElement | null = null;
  private listener: PlayerEngineListener | null = null;
  private onPlayingHandler: (() => void) | null = null;
  private onErrorHandler: (() => void) | null = null;

  async init(videoEl: HTMLVideoElement, url: string, listener: PlayerEngineListener): Promise<void> {
    this.videoEl = videoEl;
    this.listener = listener;

    this.onPlayingHandler = () => {
      this.listener?.onLoading(false);
      this.listener?.onSuccess?.();
    };
    videoEl.addEventListener('playing', this.onPlayingHandler);

    this.onErrorHandler = () => {
      const err = videoEl.error;
      let msg = 'Native player error';
      if (err) {
        if (err.code === 1) msg = 'Native player: Playback aborted';
        else if (err.code === 2) msg = 'Native player: Network error or CORS restriction';
        else if (err.code === 3) msg = 'Native player: Media decode error';
        else if (err.code === 4) msg = 'Native player: Stream format not supported natively (e.g. MPEG-TS on Chrome)';
        if (err.message && !msg.includes(err.message)) msg += `: ${err.message}`;
      } else {
        msg = 'Native player error: Failed to open media';
      }
      this.listener?.onError(msg, true);
    };
    videoEl.addEventListener('error', this.onErrorHandler);

    videoEl.src = url;

    try {
      await videoEl.play();
    } catch {
      videoEl.muted = true;
      await videoEl.play().catch(e => console.warn('Native autoplay error:', e));
    }
  }

  async play(): Promise<void> {
    if (this.videoEl) await this.videoEl.play();
  }

  pause(): void {
    if (this.videoEl) this.videoEl.pause();
  }

  seek(time: number): void {
    if (this.videoEl) this.videoEl.currentTime = time;
  }

  setVolume(volume: number): void {
    if (this.videoEl) this.videoEl.volume = Math.max(0, Math.min(1, volume));
  }

  destroy(): void {
    if (this.videoEl) {
      if (this.onPlayingHandler) {
        this.videoEl.removeEventListener('playing', this.onPlayingHandler);
        this.onPlayingHandler = null;
      }
      if (this.onErrorHandler) {
        this.videoEl.removeEventListener('error', this.onErrorHandler);
        this.onErrorHandler = null;
      }
      this.videoEl.removeAttribute('src');
      this.videoEl.load();
      this.videoEl = null;
    }
    this.listener = null;
  }

  getStats(): PlayerStats {
    const width = this.videoEl?.videoWidth || 0;
    const height = this.videoEl?.videoHeight || 0;
    return {
      engine: 'native',
      resolution: width > 0 ? `${width}x${height}` : undefined,
      videoWidth: width,
      videoHeight: height,
    };
  }

  getAudioTracks(): TrackItem[] { return []; }
  setAudioTrack(): void {}
  getSubtitleTracks(): TrackItem[] { return []; }
  setSubtitleTrack(): void {}
}
