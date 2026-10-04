import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearScrollMemory,
  readScrollMemory,
  writeScrollMemory,
} from './scrollMemory.ts';

describe('scrollMemory', () => {
  beforeEach(() => clearScrollMemory());

  it('stores and reads a per-screen entry', () => {
    writeScrollMemory('home', { focusKey: 'ROW_LIVE_x', offset: 420, row: 2 });
    expect(readScrollMemory('home')).toEqual({ focusKey: 'ROW_LIVE_x', offset: 420, row: 2 });
  });

  it('returns null for an unknown slot', () => {
    expect(readScrollMemory('missing')).toBeNull();
  });

  it('clears one slot without touching others', () => {
    writeScrollMemory('home', { focusKey: 'a', offset: 1, row: 0 });
    writeScrollMemory('live', { focusKey: 'b', offset: 2, row: 1 });
    clearScrollMemory('home');
    expect(readScrollMemory('home')).toBeNull();
    expect(readScrollMemory('live')).not.toBeNull();
  });

  it('clears everything', () => {
    writeScrollMemory('home', { focusKey: 'a', offset: 1, row: 0 });
    writeScrollMemory('live', { focusKey: 'b', offset: 2, row: 1 });
    clearScrollMemory();
    expect(readScrollMemory('home')).toBeNull();
    expect(readScrollMemory('live')).toBeNull();
  });
});
