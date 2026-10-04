import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EpgStatusLine } from './EpgStatus.tsx';

describe('EpgStatusLine', () => {
  it('announces status changes via aria-live', () => {
    const { container } = render(
      <EpgStatusLine status={{ phase: 'idle', bytesReceived: 0, programmesKept: 0 }} />
    );
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(screen.getByText('No guide data yet.')).toBeInTheDocument();
  });

  it('shows download and parse progress', () => {
    const { rerender } = render(
      <EpgStatusLine status={{ phase: 'downloading', bytesReceived: 2048, programmesKept: 0 }} />
    );
    expect(screen.getByText(/Downloading/)).toBeInTheDocument();

    rerender(
      <EpgStatusLine status={{ phase: 'parsing', bytesReceived: 0, programmesKept: 42 }} />
    );
    expect(screen.getByText(/Parsing… 42 programmes kept/)).toBeInTheDocument();
  });

  it('shows a ready message and a retry action on failure', () => {
    const { rerender } = render(
      <EpgStatusLine status={{ phase: 'ready', bytesReceived: 0, programmesKept: 5, updatedAt: Date.now() }} />
    );
    expect(screen.getByText(/Guide updated/)).toBeInTheDocument();

    const onRetry = vi.fn();
    rerender(
      <EpgStatusLine
        status={{ phase: 'failed', bytesReceived: 0, programmesKept: 0 }}
        error="CORS blocked"
        onRetry={onRetry}
      />
    );
    expect(screen.getByText('CORS blocked')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
