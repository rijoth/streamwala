import { test } from 'vitest';
import assert from 'node:assert/strict';
import { normalizeKeyEvent } from './keyCodes.ts';

function ev(init: { key?: string; keyCode?: number }): KeyboardEvent {
  return { key: init.key ?? '', keyCode: init.keyCode ?? 0, which: init.keyCode ?? 0 } as unknown as KeyboardEvent;
}

test('Android KEYCODE_DPAD_UP (19) maps to NAV_UP, not PAUSE', () => {
  assert.equal(normalizeKeyEvent(ev({ keyCode: 19 }))?.action, 'NAV_UP');
});

test('media pause maps via key name and keyCode 127', () => {
  assert.equal(normalizeKeyEvent(ev({ key: 'MediaPause' }))?.action, 'PAUSE');
  assert.equal(normalizeKeyEvent(ev({ keyCode: 127 }))?.action, 'PAUSE');
});

test('Backspace maps to BACK outside inputs', () => {
  assert.equal(normalizeKeyEvent(ev({ key: 'Backspace' }))?.action, 'BACK');
  assert.equal(normalizeKeyEvent(ev({ keyCode: 8 }))?.action, 'BACK');
  assert.equal(normalizeKeyEvent(ev({ key: 'Backspace', keyCode: 8 }))?.rawKey, 'Backspace');
});

test('digits still normalize to DIGIT', () => {
  assert.equal(normalizeKeyEvent(ev({ key: '7', keyCode: 55 }))?.digit, 7);
  assert.equal(normalizeKeyEvent(ev({ key: '7', keyCode: 103 }))?.digit, 7);
});
