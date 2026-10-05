import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The switch tone is a Web Audio graph, so there is no DOM to query: these
 * tests assert the graph that is built and that a missing/failing audio stack
 * never throws into the channel-change path.
 */

class MockAudioParam {
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class MockOscillator {
  type = 'sine';
  frequency = new MockAudioParam();
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  private listeners = new Map<string, () => void>();

  addEventListener = vi.fn((event: string, callback: () => void) => {
    this.listeners.set(event, callback);
  });

  emit(event: string) {
    this.listeners.get(event)?.();
  }
}

class MockGain {
  gain = new MockAudioParam();
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioContext {
  state: AudioContextState = 'running';
  currentTime = 0;
  destination = { name: 'destination' };
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  createOscillator = vi.fn(() => new MockOscillator());
  createGain = vi.fn(() => new MockGain());
}

async function importService() {
  return import('./channelSwitchSound.ts');
}

describe('playChannelSwitchSound', () => {
  let context: MockAudioContext;
  let AudioContextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    context = new MockAudioContext();
    AudioContextMock = vi.fn(function MockAudioContextCtor() {
      return context;
    });
    vi.stubGlobal('AudioContext', AudioContextMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a start/stop tone wired to the destination', async () => {
    const { playChannelSwitchSound } = await importService();

    playChannelSwitchSound();

    expect(AudioContextMock).toHaveBeenCalledTimes(1);
    const oscillator = context.createOscillator.mock.results[0].value as MockOscillator;
    const gain = context.createGain.mock.results[0].value as MockGain;
    expect(oscillator.frequency.setValueAtTime).toHaveBeenCalled();
    expect(oscillator.start).toHaveBeenCalledTimes(1);
    expect(oscillator.stop).toHaveBeenCalledTimes(1);
    expect(oscillator.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(context.destination);
  });

  it('reuses one audio context across switches', async () => {
    const { playChannelSwitchSound } = await importService();

    playChannelSwitchSound();
    playChannelSwitchSound();

    expect(AudioContextMock).toHaveBeenCalledTimes(1);
  });

  it('resumes a suspended context before playing', async () => {
    const { playChannelSwitchSound } = await importService();
    context.state = 'suspended';

    playChannelSwitchSound();

    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it('disconnects the audio graph when the tone ends', async () => {
    const { playChannelSwitchSound } = await importService();

    playChannelSwitchSound();

    const oscillator = context.createOscillator.mock.results[0].value as MockOscillator;
    const gain = context.createGain.mock.results[0].value as MockGain;
    oscillator.emit('ended');

    expect(oscillator.disconnect).toHaveBeenCalledTimes(1);
    expect(gain.disconnect).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the platform has no Web Audio', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { playChannelSwitchSound } = await importService();

    expect(() => playChannelSwitchSound()).not.toThrow();
  });
});
