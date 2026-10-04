/**
 * Type-safe arrow-press decisions for the focus layer.
 *
 * The underlying spatial-navigation library uses inverted polarity from what
 * most developers expect: `onArrowPress` returning `false` *prevents* the
 * default focus move, while `true` (or no handler) allows it. Returning a raw
 * boolean is therefore impossible to read at a call site and caused BUG-001
 * (nav rail returned `false` intending "allow").
 *
 * All call sites must return one of the branded {@link FocusDecision} values:
 * {@link ALLOW_DEFAULT_NAVIGATION} or {@link BLOCK_NAVIGATION}. Raw booleans do
 * not satisfy the type.
 */

const ALLOW = Symbol('streamwala.focus.ALLOW_DEFAULT_NAVIGATION');
const BLOCK = Symbol('streamwala.focus.BLOCK_NAVIGATION');

export type FocusDecision = typeof ALLOW | typeof BLOCK;

export const ALLOW_DEFAULT_NAVIGATION: FocusDecision = ALLOW;
export const BLOCK_NAVIGATION: FocusDecision = BLOCK;

export type ArrowHandler = (direction: string, context?: unknown) => FocusDecision;

/** True only when the decision explicitly blocks default navigation. */
export function isNavigationBlocked(decision: FocusDecision): boolean {
  return decision === BLOCK_NAVIGATION;
}

/**
 * Translates our {@link ArrowHandler} into the library's boolean contract.
 *
 * - no handler -> allow default navigation
 * - `ALLOW_DEFAULT_NAVIGATION` -> allow (true)
 * - `BLOCK_NAVIGATION` -> block (false)
 * - a throwing handler -> allow, so an exception can never wedge focus
 */
export function resolveArrowNavigation(
  handler: ArrowHandler | undefined,
  direction: string,
  context?: unknown
): boolean {
  if (!handler) return true;
  try {
    return !isNavigationBlocked(handler(direction, context));
  } catch (err) {
    console.warn('onArrowPress handler threw; allowing default navigation:', err);
    return true;
  }
}
