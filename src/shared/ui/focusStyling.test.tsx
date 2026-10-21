import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders.tsx';
import { expectFocused } from '../../test/expectFocused.ts';
import { setFocus } from '../focus/index.ts';
import { Button } from './Button.tsx';
import { Card } from './Card.tsx';
import { TextField } from './TextField.tsx';

/**
 * Class contract for the shared focus styling (ADR 027).
 *
 * The focus look itself is asserted in `e2e/focus-visuals.spec.ts`, because jsdom
 * resolves no `transform`/`box-shadow`. What jsdom can prove is the part that
 * actually drifted: which class lands on the focused element, and that no
 * component re-adds a Tailwind `ring-*`/`scale-*` utility. `@import
 * "tailwindcss"` puts utilities in a cascade layer while `.tv-focused` is
 * unlayered, so such a utility is always a no-op — a silent contradiction
 * between the component and the stylesheet.
 */
const DEAD_FOCUS_UTILITY = /(^|\s)(ring-\d|ring-\[|scale-\d|scale-\[)/;

function expectNoDeadFocusUtility(el: HTMLElement) {
  expect(el.className).not.toMatch(DEAD_FOCUS_UTILITY);
}

describe('shared focus styling classes', () => {
  it('Button carries tv-focus-target and gains only tv-focused', async () => {
    renderWithProviders(
      <Button focusKey="BTN_FOCUS_TEST" onClick={() => undefined}>
        Action
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Action' });
    expect(button).toHaveClass('tv-focus-target');
    expect(button).not.toHaveClass('tv-focused');

    setFocus('BTN_FOCUS_TEST');
    await waitFor(() => expectFocused('BTN_FOCUS_TEST'));
    await waitFor(() => expect(button).toHaveClass('tv-focused'));
    expectNoDeadFocusUtility(button);
  });

  it('interactive Card carries tv-focus-target and gains only tv-focused', async () => {
    renderWithProviders(
      <Card focusKey="CARD_FOCUS_TEST">
        <span>Tile</span>
      </Card>
    );

    const tile = screen.getByText('Tile').parentElement as HTMLElement;
    expect(tile).toHaveClass('tv-focus-target');

    setFocus('CARD_FOCUS_TEST');
    await waitFor(() => expectFocused('CARD_FOCUS_TEST'));
    await waitFor(() => expect(tile).toHaveClass('tv-focused'));
    expectNoDeadFocusUtility(tile);
  });

  it('non-interactive Card never takes the focus styling', () => {
    renderWithProviders(
      <Card isInteractive={false} className="layout-only">
        <span>Panel</span>
      </Card>
    );

    const panel = screen.getByText('Panel').parentElement as HTMLElement;
    expect(panel).not.toHaveClass('tv-focus-target');
    expect(panel).not.toHaveClass('tv-focused');
  });

  it('TextField is flat: tv-focus-target + tv-flat, and tv-focused only while focused', async () => {
    renderWithProviders(
      <TextField
        variant="compact"
        label="Inline search"
        value=""
        onChange={() => undefined}
        focusKey="FIELD_FOCUS_TEST"
      />
    );

    const input = screen.getByRole('textbox', { name: 'Inline search' });
    const field = input.parentElement as HTMLElement;
    // Width-derived targets must not scale: their overhang cannot be covered by
    // the fixed --focus-ring-pad (see ADR 027).
    expect(field).toHaveClass('tv-focus-target');
    expect(field).toHaveClass('tv-flat');
    expect(field).not.toHaveClass('tv-focused');

    setFocus('FIELD_FOCUS_TEST');
    await waitFor(() => expectFocused('FIELD_FOCUS_TEST'));
    await waitFor(() => expect(field).toHaveClass('tv-focused'));
    expectNoDeadFocusUtility(field);
  });
});
