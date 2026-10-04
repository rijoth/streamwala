import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
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

describe('useFocusable scroll safety (BUG-014 regression)', () => {
  const originalScroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');

  afterEach(() => {
    if (originalScroll) {
      Object.defineProperty(Element.prototype, 'scrollIntoView', originalScroll);
    } else {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('focuses without throwing when scrollIntoView is unavailable', async () => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    render(<Probe />);

    setFocus('GR_SCROLL_A');
    await waitFor(() => expect(getCurrentFocusKey()).toBe('GR_SCROLL_A'));
  });
});