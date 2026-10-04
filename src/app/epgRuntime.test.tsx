import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { EpgProvider, useNowNext } from './epgRuntime.tsx';
import { createFakeEpgRepository } from '../services/epg/fakeRepository.ts';

function Probe({ channelId }: { channelId: string }) {
  const { current, next, progress } = useNowNext(channelId);
  return (
    <div data-testid="probe">
      {current?.title ?? 'none'}|{next?.title ?? 'none'}|{progress.toFixed(2)}
    </div>
  );
}

describe('EpgProvider / useNowNext', () => {
  it('exposes Now/Next from the repository', async () => {
    const repository = createFakeEpgRepository();
    const now = Date.now();
    await repository.applyProgrammeImport([
      {
        channelId: 'ch1',
        programs: [
          { id: 'a', channelId: 'ch1', start: now - 1000, stop: now + 1000, title: 'Current' },
          { id: 'b', channelId: 'ch1', start: now + 1000, stop: now + 2000, title: 'Next' },
        ],
      },
    ]);

    render(
      <EpgProvider channels={[]} repository={repository}>
        <Probe channelId="ch1" />
      </EpgProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('probe').textContent).toContain('Current')
    );
    expect(screen.getByTestId('probe').textContent).toContain('Next');
  });

  it('returns an empty result without a provider', () => {
    render(<Probe channelId="ch1" />);
    expect(screen.getByTestId('probe').textContent).toBe('none|none|0.00');
  });
});
