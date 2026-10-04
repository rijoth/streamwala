import React, { useMemo, useState } from 'react';
import type { Channel, EpgChannel } from '../../../domain/types.ts';
import { Button, SideSheet, TextField } from '../../../shared/ui/index.ts';

export interface EpgManualMappingDialogProps {
  isOpen: boolean;
  channel: Channel | null;
  epgChannels: EpgChannel[];
  onSelect: (epgChannel: EpgChannel) => void;
  onUnmap: () => void;
  onClose: () => void;
}

/**
 * Searchable XMLTV-channel picker for one playlist channel. A manual mapping
 * always overrides auto-matching and survives re-sync/refresh.
 */
export const EpgManualMappingDialog: React.FC<EpgManualMappingDialogProps> = ({
  isOpen,
  channel,
  epgChannels,
  onSelect,
  onUnmap,
  onClose,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? epgChannels.filter(
          (c) =>
            c.xmltvId.toLowerCase().includes(q) ||
            c.displayNames.some((name) => name.toLowerCase().includes(q))
        )
      : epgChannels;
    return list.slice(0, 100);
  }, [epgChannels, query]);

  return (
    <SideSheet
      isOpen={isOpen}
      onClose={onClose}
      title={channel ? `Map ${channel.name}` : 'Map channel'}
      icon="link"
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Search EPG channels"
          value={query}
          onChange={setQuery}
          placeholder="Channel id or name"
          icon="search"
          focusKey="EPG_MAP_SEARCH"
          autoFocus
        />

        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--md-sys-color-outline)]">
            No EPG channels match. Refresh the guide first or import a source.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((epgChannel) => (
              <Button
                key={epgChannel.id}
                variant="tonal"
                className="!justify-start !py-3 text-left"
                onClick={() => onSelect(epgChannel)}
              >
                <span className="flex flex-col items-start">
                  <span className="font-semibold text-sm">
                    {epgChannel.displayNames[0] ?? epgChannel.xmltvId}
                  </span>
                  <span className="text-xs font-mono text-[var(--md-sys-color-outline)]">
                    {epgChannel.xmltvId}
                  </span>
                </span>
              </Button>
            ))}
          </div>
        )}

        <Button variant="outlined" icon="link_off" onClick={onUnmap} className="mt-2">
          Unmap channel
        </Button>
      </div>
    </SideSheet>
  );
};
