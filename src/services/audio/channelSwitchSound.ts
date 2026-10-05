/**
 * Channel-switch confirmation tone.
 *
 * Synthesised with the Web Audio API instead of shipped as an audio asset: it
 * needs no network fetch (so it works offline in the Capacitor shell and on a
 * cold boot), adds nothing to the bundle, and cannot be muted or torn down by
 * the media element the player engine owns. The `AudioContext` is created
 * lazily on the first switch, which happens inside a remote-key gesture, so the
 * browser autoplay policy does not suspend it.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') {
    return null;
  }
  if (!audioContext) {
    audioContext = new window.AudioContext();
  }
  return audioContext;
}

/**
 * Play the short rising blip. Best-effort by design: a missing or suspended
 * audio context must never delay or block the channel change it confirms.
 */
export function playChannelSwitchSound(): void {
  const context = getAudioContext();
  if (!context) return;

  // A context created before the first user gesture starts suspended; resuming
  // here is best-effort and cannot throw into the caller.
  if (context.state === 'suspended') {
    void context.resume().catch(() => {});
  }

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(660, now);
  oscillator.frequency.exponentialRampToValueAtTime(990, now + 0.07);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.15, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.12);
  oscillator.addEventListener('ended', () => {
    oscillator.disconnect();
    gain.disconnect();
  });
}
