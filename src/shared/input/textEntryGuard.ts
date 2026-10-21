import { isEditableElement } from './useTvInput.ts';

/**
 * Text-entry contexts that must keep raw digits for themselves.
 *
 * The shared input hook already skips DIGIT while a real `<input>` owns the
 * caret, but an on-screen keyboard and a modal are focusable widgets rather
 * than editable elements. They mark themselves with these data attributes so
 * the app-level number entry can stand down without every caller wiring a flag.
 */
const TEXT_ENTRY_MARKER = '[data-text-entry]';
const OPEN_TEXT_ENTRY_MARKER = '[data-text-entry-open]';
const MODAL_MARKER = '[data-input-blocker]';

export function isTextEntryContextActive(): boolean {
  if (typeof document === 'undefined') return false;

  const active = document.activeElement;
  if (isEditableElement(active)) return true;
  if (active instanceof Element && active.closest(TEXT_ENTRY_MARKER)) return true;

  return (
    document.querySelector(OPEN_TEXT_ENTRY_MARKER) !== null ||
    document.querySelector(MODAL_MARKER) !== null
  );
}
