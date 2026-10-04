import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import rule from './no-raw-key-listeners.mjs';

// Wire ESLint's RuleTester into the node:test runner.
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-raw-key-listeners', rule, {
  valid: [
    // Element-scoped listeners are out of scope (e.g. <video> in PlayerEngine).
    "videoEl.addEventListener('playing', handler)",
    "this.videoEl.addEventListener('error', handler)",
    "videoEl.addEventListener('keydown', handler)",
    // Non-key window events are fine.
    "window.addEventListener('mousemove', handler)",
    "window.addEventListener('resize', handler)",
    "document.addEventListener('visibilitychange', handler)",
    // Non-key element events via a query result are out of scope.
    "document.querySelector('#x').addEventListener('keydown', handler)",
  ],
  invalid: [
    { code: "window.addEventListener('keydown', handler)", errors: [{ messageId: 'noRawKeyListener' }] },
    { code: 'document.addEventListener("keyup", handler)', errors: [{ messageId: 'noRawKeyListener' }] },
    { code: "document.body.addEventListener('keypress', handler)", errors: [{ messageId: 'noRawKeyListener' }] },
    { code: "globalThis.addEventListener('keydown', handler)", errors: [{ messageId: 'noRawKeyListener' }] },
    { code: "self.addEventListener('keydown', handler)", errors: [{ messageId: 'noRawKeyListener' }] },
    { code: "addEventListener('keydown', handler)", errors: [{ messageId: 'noRawKeyListener' }] },
    { code: 'window.addEventListener(`keydown`, handler)', errors: [{ messageId: 'noRawKeyListener' }] },
    { code: 'window.addEventListener(`key${suffix}`, handler)', errors: [{ messageId: 'noRawKeyListener' }] },
    { code: 'window.addEventListener(eventName, handler)', errors: [{ messageId: 'noRawKeyListener' }] },
    { code: "const name = 'keydown'; window.addEventListener(name, handler)", errors: [{ messageId: 'noRawKeyListener' }] },
  ],
});
