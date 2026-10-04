import React from 'react';
import { FocusZone } from '../../shared/focus/index.ts';
import { Button } from '../../shared/ui/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import { PlayerStats, TrackItem } from '../../services/player/PlayerEngine.ts';

export interface PlayerControlsOverlayProps {
  isVisible: boolean;
  isPlaying: boolean;
  aspectRatio: string;
  onTogglePlay: () => void;
  onToggleMiniChannelList: () => void;
  onCycleAspectRatio: () => void;
  onToggleNerdStats: () => void;
  onTogglePiP: () => void;
  onToggleFullscreen: () => void;
  onPrevChannel: () => void;
  onNextChannel: () => void;
  stats?: PlayerStats | null;
  audioTracks: TrackItem[];
  subtitleTracks: TrackItem[];
  onSelectAudioTrack: (id: number) => void;
  onSelectSubtitleTrack: (id: number) => void;
}

export const PlayerControlsOverlay: React.FC<PlayerControlsOverlayProps> = ({
  isVisible,
  isPlaying,
  aspectRatio,
  onTogglePlay,
  onToggleMiniChannelList,
  onCycleAspectRatio,
  onToggleNerdStats,
  onTogglePiP,
  onToggleFullscreen,
  onPrevChannel,
  onNextChannel,
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end p-10 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-auto animate-fade-in">
      <FocusZone className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
        {/* Main Controls Row */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="tonal"
            icon="skip_previous"
            onClick={onPrevChannel}
            className="!p-4 !rounded-2xl"
          >
            Prev CH
          </Button>

          <Button
            variant="filled"
            icon={isPlaying ? 'pause' : 'play_arrow'}
            onClick={onTogglePlay}
            autoFocus
            className="!p-5 !rounded-3xl shadow-2xl !bg-[var(--md-sys-color-primary)] text-black font-bold scale-110"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </Button>

          <Button
            variant="tonal"
            icon="skip_next"
            onClick={onNextChannel}
            className="!p-4 !rounded-2xl"
          >
            Next CH
          </Button>
        </div>

        {/* Secondary Utility Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10 text-white/80">
          <div className="flex items-center gap-3">
            <Button
              variant="tonal"
              icon="format_list_bulleted"
              onClick={onToggleMiniChannelList}
              className="text-sm !py-2 !px-4"
            >
              Channel List
            </Button>

            <Button
              variant="tonal"
              icon="aspect_ratio"
              onClick={onCycleAspectRatio}
              className="text-sm !py-2 !px-4 uppercase"
            >
              Aspect: {aspectRatio}
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="tonal"
              icon="query_stats"
              onClick={onToggleNerdStats}
              className="text-sm !py-2 !px-4"
            >
              Nerd Stats
            </Button>

            {'pictureInPictureEnabled' in document && (
              <Button
                variant="tonal"
                icon="picture_in_picture_alt"
                onClick={onTogglePiP}
                className="text-sm !py-2 !px-4"
              >
                PiP
              </Button>
            )}

            <Button
              variant="tonal"
              icon="fullscreen"
              onClick={onToggleFullscreen}
              className="text-sm !py-2 !px-4"
            >
              Fullscreen
            </Button>
          </div>
        </div>

        {/* Remote D-Pad Navigation Hint Legend */}
        <div className="flex items-center justify-center gap-6 text-xs text-white/50 pt-2 font-medium">
          <span className="flex items-center gap-1.5">
            <Icon name="swap_vert" size={16} />
            <span>▲ / ▼ : Channel Zapping</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="swap_horiz" size={16} />
            <span>◄ / ► : Controls / Seek</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="dialpad" size={16} />
            <span>0-9 : Direct Number Entry</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="arrow_back" size={16} />
            <span>BACK : Exit / Menu</span>
          </span>
        </div>
      </FocusZone>
    </div>
  );
};
