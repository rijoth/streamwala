import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders.tsx';
import { useScrollRestore } from './useScrollRestore.ts';
import { clearScrollMemory, writeScrollMemory } from './scrollMemory.ts';
import { useFocusable } from '../focus/index.ts';
import { setFocus } from '../focus/index.ts';
import type { ScrollAxisApi } from './useScrollAxis.ts';

// Spy on the one API the hook uses to move focus, while keeping the real focus
// engine for registration/existence checks.
vi.mock('../focus/index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../focus/index.ts')>();
  return { ...actual, setFocus: vi.fn(actual.setFocus) };
});

function createAxis(overrides: Partial<ScrollAxisApi> = {}): ScrollAxisApi {
  return {
    orientation: 'vertical',
    viewportRef: { current: null },
    contentRef: { current: null },
    getOffset: () => 0,
    getContentSize: () => 1000,
    getViewportSize: () => 500,
    setSizes: vi.fn(),
    setPendingOffset: vi.fn(),
    onSized: () => () => undefined,
    isSized: () => true,
    scrollToOffset: vi.fn(),
    scrollBy: vi.fn(),
    subscribe: () => () => undefined,
    isAnimating: () => false,
    ...overrides,
  };
}

const FocusTarget: React.FC = () => {
  useFocusable({ focusKey: 'TARGET_CARD' });
  return <div data-testid="target" />;
};

const Harness: React.FC<{ axis: ScrollAxisApi; enabled?: boolean }> = ({
  axis,
  enabled = true,
}) => {
  useScrollRestore('restore-slot', axis, enabled);
  return <FocusTarget />;
};

describe('useScrollRestore', () => {
  beforeEach(() => {
    clearScrollMemory();
    vi.mocked(setFocus).mockClear();
  });

  it('restores the offset but never steals focus from an editable element', () => {
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'query');
    document.body.appendChild(input);
    input.focus();
    expect(document.activeElement).toBe(input);

    writeScrollMemory('restore-slot', { focusKey: 'TARGET_CARD', offset: 240, row: 1 });
    const axis = createAxis();

    renderWithProviders(<Harness axis={axis} />);

    expect(axis.setPendingOffset).toHaveBeenCalledWith(240);
    expect(setFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);

    input.remove();
  });

  it('restores the remembered focus target when focus is not editable', async () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    writeScrollMemory('restore-slot', { focusKey: 'TARGET_CARD', offset: 120, row: 0 });
    const axis = createAxis();

    renderWithProviders(<Harness axis={axis} />);

    await waitFor(() => expect(setFocus).toHaveBeenCalledWith('TARGET_CARD'));
    expect(axis.setPendingOffset).toHaveBeenCalledWith(120);
  });

  it('skips the restore entirely when disabled', () => {
    writeScrollMemory('restore-slot', { focusKey: 'TARGET_CARD', offset: 120, row: 0 });
    const axis = createAxis();

    renderWithProviders(<Harness axis={axis} enabled={false} />);

    expect(axis.setPendingOffset).not.toHaveBeenCalled();
    expect(setFocus).not.toHaveBeenCalled();
  });

  it('does nothing when the slot has no memory', () => {
    const axis = createAxis();
    renderWithProviders(<Harness axis={axis} />);
    expect(axis.setPendingOffset).not.toHaveBeenCalled();
    expect(setFocus).not.toHaveBeenCalled();
  });
});
