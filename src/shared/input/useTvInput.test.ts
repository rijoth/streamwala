import { test } from 'vitest';
import assert from 'node:assert/strict';
import { pushBackHandler, dispatchBack } from './useTvInput.ts';

test('dispatchBack invokes and pops exactly one handler per call', () => {
  const calls: string[] = [];
  const removeA = pushBackHandler(() => {
    calls.push('a');
    return true;
  });
  const removeB = pushBackHandler(() => {
    calls.push('b');
    return true;
  });

  assert.equal(dispatchBack(), true);
  assert.deepEqual(calls, ['b'], 'only the top handler must run');

  assert.equal(dispatchBack(), true);
  assert.deepEqual(calls, ['b', 'a'], 'second call reaches the next handler');

  assert.equal(dispatchBack(), false, 'empty stack reports no handler');

  removeA();
  removeB();
});

test('dispatchBack keeps a handler that reports handled=false', () => {
  const calls: string[] = [];
  const remove = pushBackHandler(() => {
    calls.push('keep');
    return false;
  });

  assert.equal(dispatchBack(), true);
  assert.deepEqual(calls, ['keep']);
  assert.equal(dispatchBack(), true);
  assert.deepEqual(calls, ['keep', 'keep'], 'unhandled handler stays on the stack');

  remove();
  assert.equal(dispatchBack(), false);
});
