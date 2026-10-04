import React, { useEffect, useState } from 'react';
import type { Channel, Playlist } from '../../../domain/types.ts';
import { Button } from '../../../shared/ui/index.ts';
import { getChannelsByGroup, savePlaylist } from '../../../services/storage/db.ts';
import type { EpgRepository } from '../../../services/epg/repository.ts';
import { EpgSourceSection } from './EpgSourceSection.tsx';
import { EpgMatchReport } from './EpgMatchReport.tsx';
import { EpgManualMappingDialog } from './EpgManualMappingDialog.tsx';
import { useEpgManager } from './useEpgManager.ts';

export interface PlaylistEpgPanelProps {
  playlist: Playlist;
  /** Optional preloaded channels; the panel loads them when omitted. */
  channels?: Channel[];
  repository?: EpgRepository;
  onClose: () => void;
  onChanged?: () => void;
}

/**
 * Playlist edit → EPG section. Owns source management, refresh, the match
 * report and manual mapping. D-pad reachable end to end; BACK closes the
 * mapping sheet first (SideSheet) and then returns to the playlist list.
 */
export const PlaylistEpgPanel: React.FC<PlaylistEpgPanelProps> = ({
  playlist,
  channels: preloadedChannels,
  repository,
  onClose,
  onChanged,
}) => {
  const [loadedChannels, setLoadedChannels] = useState<Channel[]>(preloadedChannels ?? []);

  useEffect(() => {
    if (preloadedChannels) {
      setLoadedChannels(preloadedChannels);
      return;
    }
    let cancelled = false;
    void getChannelsByGroup(playlist.id).then((result) => {
      if (!cancelled) setLoadedChannels(result);
    });
    return () => {
      cancelled = true;
    };
  }, [playlist.id, preloadedChannels]);

  const manager = useEpgManager({ playlist, channels: loadedChannels, repository, onChanged });
  const [mappingChannel, setMappingChannel] = useState<Channel | null>(null);

  return (
    <div className="flex flex-col gap-5 h-full min-h-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-lg truncate">Program guide — {playlist.name}</h3>
          <p className="text-xs text-[var(--md-sys-color-outline)]">
            Attach one or more XMLTV sources. Multiple sources merge by priority.
          </p>
        </div>
        <Button variant="outlined" icon="arrow_back" onClick={onClose} className="shrink-0">
          Back
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-6 pr-1">
        <EpgSourceSection
          manager={manager}
          onSourceAdded={(url) => {
            void savePlaylist({ ...playlist, epgUrl: url, epgPromptDismissed: true }).then(() =>
              onChanged?.()
            );
          }}
        />

        <EpgMatchReport
          report={manager.report}
          channels={loadedChannels}
          onMap={(channel) => setMappingChannel(channel)}
          onUnmap={(channelId) => void manager.unmapChannel(channelId)}
        />
      </div>

      <EpgManualMappingDialog
        isOpen={mappingChannel !== null}
        channel={mappingChannel}
        epgChannels={manager.epgChannels}
        onSelect={(epgChannel) => {
          if (mappingChannel) void manager.mapChannel(mappingChannel.id, epgChannel);
          setMappingChannel(null);
        }}
        onUnmap={() => {
          if (mappingChannel) void manager.unmapChannel(mappingChannel.id);
          setMappingChannel(null);
        }}
        onClose={() => setMappingChannel(null)}
      />
    </div>
  );
};
