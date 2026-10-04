import React from 'react';
import type { Playlist } from '../../../domain/types.ts';
import { Button } from '../../../shared/ui/index.ts';
import { Icon } from '../../../shared/icons/index.ts';

export interface EpgFirstRunBannerProps {
  playlist: Playlist;
  onAddGuide: () => void;
  onDismiss: () => void;
}

/**
 * First-run prompt on playlists with no EPG. D-pad reachable and dismissible;
 * the dismissal is remembered on the playlist (`epgPromptDismissed`).
 */
export const EpgFirstRunBanner: React.FC<EpgFirstRunBannerProps> = ({
  playlist,
  onAddGuide,
  onDismiss,
}) => {
  return (
    <div
      data-testid={`epg-banner-${playlist.id}`}
      className="p-4 rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Icon name="live_tv" size={24} />
        <div className="min-w-0">
          <h4 className="font-semibold text-sm">Add a program guide?</h4>
          <p className="text-xs opacity-90 truncate">
            Attach an XMLTV source to {playlist.name} for Now/Next and the timeline guide.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="filled" icon="add" onClick={onAddGuide} className="!px-3 !py-1.5 text-xs">
          Add program guide
        </Button>
        <Button
          variant="text"
          aria-label="Dismiss"
          icon="close"
          className="!px-2 !py-1.5 text-xs"
          onClick={onDismiss}
        />
      </div>
    </div>
  );
};
