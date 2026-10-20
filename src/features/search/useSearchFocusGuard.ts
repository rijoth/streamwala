import { useLayoutEffect, useRef } from 'react';
import { getCurrentFocusKey, setFocus } from '../../shared/focus/index.ts';
import {
  gridRows,
  minimalScrollOffset,
  rowForIndex,
  type ScrollAxisApi,
  type ScrollConfig,
} from '../../shared/scroll/index.ts';

export interface SearchFocusGuardOptions {
  /** Channels currently rendered by the filtered grid, in display order. */
  items: readonly { id: string }[];
  isSearching: boolean;
  /** Focus key of the screen's search field (the fallback when a card vanishes). */
  fieldFocusKey: string;
  /**
   * Focus-key prefixes that identify a result card. Live TV needs both its grid
   * and list prefixes because the view toggle changes the card type.
   */
  resultFocusPrefixes: readonly string[];
  axis: ScrollAxisApi;
  columns: number;
  /** Row pitch in px (item height + gap), as returned by the scroller. */
  rowSize: number;
  config: ScrollConfig;
}

/**
 * Keeps focus and the scroll offset consistent while a filtered grid changes
 * under the focus ring.
 *
 * Rules:
 * - A query transition always starts the (new) list at the top.
 * - While a *surviving* result card keeps focus, its new row is re-anchored so
 *   a narrowing query never leaves the viewport on a stale offset.
 * - When the focused card no longer matches, focus falls back to the search
 *   field instead of dangling on a removed focusable (which would drop DOM
 *   focus to `<body>` and dead-end the D-pad).
 * - While the field owns engine focus the list stays at the top; result cards
 *   are never auto-focused.
 *
 * Query changes are deliberately absent from this hook's effects: the scroller
 * is keyed by screen, not by query, so typing never re-runs scroll restore.
 */
export function useSearchFocusGuard({
  items,
  isSearching,
  fieldFocusKey,
  resultFocusPrefixes,
  axis,
  columns,
  rowSize,
  config,
}: SearchFocusGuardOptions): void {
  const wasSearchingRef = useRef(isSearching);
  const prefixKey = resultFocusPrefixes.join('|');

  useLayoutEffect(() => {
    const wasSearching = wasSearchingRef.current;
    wasSearchingRef.current = isSearching;

    if (wasSearching !== isSearching) {
      axis.scrollToOffset(0, { animate: false });
      if (!isSearching) return;
    }

    if (!isSearching) return;

    const currentKey = getCurrentFocusKey() ?? '';
    if (currentKey === fieldFocusKey) {
      axis.scrollToOffset(0, { animate: false });
      return;
    }

    const prefix = resultFocusPrefixes.find((candidate) => currentKey.startsWith(candidate));
    if (!prefix) return;

    const channelId = currentKey.slice(prefix.length);
    const index = items.findIndex((item) => item.id === channelId);
    const safeColumns = Math.max(1, columns);
    const viewportSize = axis.getViewportSize();
    const contentSize = gridRows(items.length, safeColumns) * rowSize;
    axis.setSizes(contentSize, viewportSize);

    if (index < 0) {
      // The focused card was filtered out. Return focus to the field before
      // the engine is left pointing at an unmounted focusable.
      setFocus(fieldFocusKey);
      axis.scrollToOffset(0, { animate: false });
      return;
    }

    const target = minimalScrollOffset(
      axis.getOffset(),
      rowForIndex(index, safeColumns),
      rowSize,
      viewportSize,
      contentSize,
      config
    );
    axis.scrollToOffset(target, { animate: false });
  }, [
    items,
    isSearching,
    fieldFocusKey,
    prefixKey,
    resultFocusPrefixes,
    axis,
    columns,
    rowSize,
    config,
  ]);
}
