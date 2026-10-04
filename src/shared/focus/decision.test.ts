import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOW_DEFAULT_NAVIGATION,
  BLOCK_NAVIGATION,
  isNavigationBlocked,
  resolveArrowNavigation,
  type ArrowHandler,
  type FocusDecision,
} from './decision.ts';

test('no handler allows default navigation', () => {
  assert.equal(resolveArrowNavigation(undefined, 'right'), true);
});

test('ALLOW_DEFAULT_NAVIGATION allows navigation', () => {
  assert.equal(resolveArrowNavigation(() => ALLOW_DEFAULT_NAVIGATION, 'left'), true);
});

test('BLOCK_NAVIGATION blocks navigation', () => {
  assert.equal(resolveArrowNavigation(() => BLOCK_NAVIGATION, 'right'), false);
});

test('isNavigationBlocked reflects only the BLOCK sentinel', () => {
  assert.equal(isNavigationBlocked(ALLOW_DEFAULT_NAVIGATION), false);
  assert.equal(isNavigationBlocked(BLOCK_NAVIGATION), true);
});

test('a throwing handler allows navigation instead of wedging focus', () => {
  const handler: ArrowHandler = () => {
    throw new Error('boom');
  };
  assert.equal(resolveArrowNavigation(handler, 'up'), true);
});

// Compile-time guard: raw booleans must not satisfy the FocusDecision API.
// @ts-expect-error a raw boolean is not a FocusDecision
const _rawDecision: FocusDecision = true;
// @ts-expect-error arrow handlers must return a FocusDecision, not a boolean
const _rawHandler: ArrowHandler = () => false;
