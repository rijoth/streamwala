import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKeyEvent } from './src/shared/input/keyCodes.ts';

test('digit', () => {
  const e = { keyCode: 49, which: 49, key: '1' } as unknown as KeyboardEvent;
  assert.equal(normalizeKeyEvent(e)?.digit, 1);
});
