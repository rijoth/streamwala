import { describe, it, expect } from 'vitest';
import { shouldYieldDpadToOverlay } from './dpadOverlayPolicy.ts';

describe('shouldYieldDpadToOverlay (BUG-013 regression)', () => {
  it('yields to the focus engine while the controls overlay is open', () => {
    expect(shouldYieldDpadToOverlay(true, 'playing')).toBe(true);
    expect(shouldYieldDpadToOverlay(true, 'paused')).toBe(true);
  });

  it('yields to the focus engine while the error overlay is open', () => {
    expect(shouldYieldDpadToOverlay(false, 'error')).toBe(true);
  });

  it('keeps zapping when no overlay owns focus', () => {
    expect(shouldYieldDpadToOverlay(false, 'playing')).toBe(false);
    expect(shouldYieldDpadToOverlay(false, 'loading')).toBe(false);
    expect(shouldYieldDpadToOverlay(false, 'idle')).toBe(false);
  });
});