import React from 'react';
import { describe, it, expect } from 'vitest';
import { act, render } from '@testing-library/react';
import { useVirtualWindow } from './useVirtualWindow.ts';
import type { ScrollAxisApi } from './useScrollAxis.ts';

function makeAxis(offset: number, viewportSize: number) {
  const listeners = new Set<(value: number) => void>();
  const axis = {
    getOffset: () => offset,
    getViewportSize: () => viewportSize,
    subscribe: (listener: (value: number) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const emit = (next: number) => {
    offset = next;
    listeners.forEach((listener) => listener(next));
  };
  return { axis: axis as unknown as ScrollAxisApi, emit };
}

function Harness({ axis, itemSize, count, overscan }: { axis: ScrollAxisApi; itemSize: number; count: number; overscan: number }) {
  const range = useVirtualWindow(axis, itemSize, count, overscan);
  return (
    <div data-testid="range">
      {range.start}-{range.end}
    </div>
  );
}

describe('useVirtualWindow', () => {
  it('computes the initial window from the current offset', () => {
    const { axis } = makeAxis(0, 400);
    const { getByTestId } = render(<Harness axis={axis} itemSize={100} count={1000} overscan={2} />);
    expect(getByTestId('range').textContent).toBe('0-6');
  });

  it('recomputes the window as the offset advances', () => {
    const { axis, emit } = makeAxis(0, 400);
    const { getByTestId } = render(<Harness axis={axis} itemSize={100} count={1000} overscan={2} />);
    expect(getByTestId('range').textContent).toBe('0-6');
    act(() => emit(10));
    expect(getByTestId('range').textContent).toBe('0-7');
    act(() => emit(1000));
    expect(getByTestId('range').textContent).toBe('8-16');
  });

  it('clamps to the item count', () => {
    const { axis } = makeAxis(0, 100, );
    const { getByTestId } = render(<Harness axis={axis} itemSize={50} count={3} overscan={5} />);
    expect(getByTestId('range').textContent).toBe('0-3');
  });
});
