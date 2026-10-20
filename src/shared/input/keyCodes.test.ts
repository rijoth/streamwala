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

test('DOM Pause key wins over the shared legacy keyCode 19', () => {
  // KeyboardEvent for the Pause key reports keyCode 19, which is also accepted
  // as Android D-pad up. The key name must disambiguate it to PAUSE.
  assert.equal(normalizeKeyEvent(ev({ key: 'Pause', keyCode: 19 }))?.action, 'PAUSE');
});

test('Tizen/webOS colour keycodes map to colour actions', () => {
  assert.equal(normalizeKeyEvent(ev({ keyCode: 403 }))?.action, 'COLOR_RED');
  assert.equal(normalizeKeyEvent(ev({ keyCode: 404 }))?.action, 'COLOR_GREEN');
  assert.equal(normalizeKeyEvent(ev({ keyCode: 405 }))?.action, 'COLOR_YELLOW');
  assert.equal(normalizeKeyEvent(ev({ keyCode: 406 }))?.action, 'COLOR_BLUE');
});

test('Android PROG keycodes stay unbound so they cannot hijack character input', () => {
  // 186/187/189 are the legacy keyCodes for ';', '=' and '-'.
  assert.equal(normalizeKeyEvent(ev({ key: ';', keyCode: 186 })), null);
  assert.equal(normalizeKeyEvent(ev({ key: '=', keyCode: 187 })), null);
  assert.equal(normalizeKeyEvent(ev({ key: '-', keyCode: 189 })), null);
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
