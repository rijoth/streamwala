import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders.tsx';
import { dispatchBack } from '../../../shared/input/index.ts';
import type { Channel, EpgChannel } from '../../../domain/types.ts';
import { EpgManualMappingDialog } from './EpgManualMappingDialog.tsx';

const channel: Channel = {
  id: 'ch1',
  playlistId: 'pl1',
  name: 'Discovery',
  groupId: 'g',
  groupName: 'G',
  streamUrl: 'https://example.invalid/s.ts',
};

const epgChannels: EpgChannel[] = [
  { id: 'src1::cnn', sourceId: 'src1', playlistId: 'pl1', xmltvId: 'cnn', displayNames: ['CNN'] },
  {
    id: 'src1::disc',
    sourceId: 'src1',
    playlistId: 'pl1',
    xmltvId: 'disc',
    displayNames: ['Discovery HD'],
  },
];

describe('EpgManualMappingDialog', () => {
  it('lists candidates, filters by search and selects one', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <EpgManualMappingDialog
        isOpen
        channel={channel}
        epgChannels={epgChannels}
        onSelect={onSelect}
        onUnmap={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('CNN')).toBeInTheDocument();
    expect(screen.getByText('Discovery HD')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Channel id or name'), {
      target: { value: 'disc' },
    });
    expect(screen.queryByText('CNN')).not.toBeInTheDocument();
    expect(screen.getByText('Discovery HD')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Discovery HD'));
    expect(onSelect).toHaveBeenCalledWith(epgChannels[1]);
  });

  it('closes on BACK before anything behind it', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <EpgManualMappingDialog
        isOpen
        channel={channel}
        epgChannels={epgChannels}
        onSelect={vi.fn()}
        onUnmap={vi.fn()}
        onClose={onClose}
      />
    );

    act(() => {
      dispatchBack();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
