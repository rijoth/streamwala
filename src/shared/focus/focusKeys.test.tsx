import React from 'react';
import { describe, it, expect } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders.tsx';
import { expectFocused } from '../../test/expectFocused.ts';
import { setFocus, useFocusable } from './index.ts';

function Probe() {
  const a = useFocusable({ focusKey: 'GR_TEST_A' });
  const b = useFocusable({ focusKey: 'GR_TEST_B' });

  return (
    <div>
      <button ref={a.ref as React.Ref<HTMLButtonElement>} data-testid="a">
        A
      </button>
      <button ref={b.ref as React.Ref<HTMLButtonElement>} data-testid="b">
        B
      </button>
    </div>
  );
}

describe('explicit focus keys', () => {
  it('moves focus by key and reports it via getCurrentFocusKey()', async () => {
    renderWithProviders(<Probe />);

    setFocus('GR_TEST_B');
    await waitFor(() => expectFocused('GR_TEST_B'));

    setFocus('GR_TEST_A');
    await waitFor(() => expectFocused('GR_TEST_A'));

    expect(getActiveTestId()).toBe('a');
  });
});

function getActiveTestId(): string | null {
  const el = document.activeElement;
  return el instanceof HTMLElement ? el.getAttribute('data-testid') : null;
}