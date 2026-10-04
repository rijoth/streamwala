import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { setFocus, useFocusable, getCurrentFocusKey } from './index.ts';

function Probe() {
  const { ref } = useFocusable({ focusKey: 'GR_SCROLL_A', autoScroll: true });
  return (
    <div ref={ref as React.Ref<HTMLDivElement>} data-testid="scroll-a">
      A
    </div>
  );
}

/**
 * Scrolling is no longer performed by the focus hook. Focus is the source of
 * truth and `src/shared/scroll` derives offsets from it, so focusing must never
 * touch `scrollIntoView` (BUG-014's crash path is gone by construction).
 */
describe('useFocusable does not scroll (scroll system owns offsets)', () => {
  const original = Element.prototype.scrollIntoView;

  afterEach(() => {
    Element.prototype.scrollIntoView = original;
  });

  it('never calls scrollIntoView when focus moves', async () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;

    render(<Probe />);

    setFocus('GR_SCROLL_A');
    await waitFor(() => expect(getCurrentFocusKey()).toBe('GR_SCROLL_A'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('focuses without throwing when scrollIntoView is unavailable', async () => {
    // @ts-expect-error deliberately removing a DOM method for the webview case
    delete Element.prototype.scrollIntoView;

    render(<Probe />);

    setFocus('GR_SCROLL_A');
    await waitFor(() => expect(getCurrentFocusKey()).toBe('GR_SCROLL_A'));
  });
});
