/**
 * Per-screen, per-row scroll + focus memory.
 *
 * Module-level so it survives the unmount that happens when the player opens:
 * returning from the player, a dialog or a route change restores the exact
 * focused card and offset with no visible jump.
 */
export interface ScrollMemoryEntry {
  focusKey: string | null;
  offset: number;
  row: number;
}

const memory = new Map<string, ScrollMemoryEntry>();

export function writeScrollMemory(key: string, entry: ScrollMemoryEntry): void {
  memory.set(key, entry);
}

export function readScrollMemory(key: string): ScrollMemoryEntry | null {
  return memory.get(key) ?? null;
}

/** Clears one slot, or everything when called with no argument. */
export function clearScrollMemory(key?: string): void {
  if (key === undefined) memory.clear();
  else memory.delete(key);
}
