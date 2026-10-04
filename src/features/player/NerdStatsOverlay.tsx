import React from 'react';
import { PlayerStats } from '../../services/player/PlayerEngine.ts';
import { Icon } from '../../shared/icons/index.ts';

export interface NerdStatsOverlayProps {
  stats: PlayerStats | null;
  streamUrl: string;
  isVisible: boolean;
  onClose: () => void;
}

export const NerdStatsOverlay: React.FC<NerdStatsOverlayProps> = ({
  stats,
  streamUrl,
  isVisible,
  onClose,
}) => {
  if (!isVisible || !stats) return null;

  // Mask sensitive parts of the stream URL (e.g. passwords/tokens)
  const maskedUrl = streamUrl.replace(/\/live\/([^/]+)\/([^/]+)\//, '/live/$1/••••••••/');

  return (
    <div className="fixed top-8 left-8 z-50 animate-fade-in pointer-events-auto">
      <div className="bg-black/90 backdrop-blur-md p-5 rounded-2xl border border-white/20 shadow-2xl text-xs font-mono text-emerald-400 w-96 flex flex-col gap-2">
        <div className="flex items-center justify-between pb-2 border-b border-white/10 text-white font-sans font-bold">
          <div className="flex items-center gap-2">
            <Icon name="terminal" size={16} className="text-emerald-400" />
            <span>Nerd Diagnostics</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white cursor-pointer"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-white/60">Playback Engine:</span>
            <span className="font-bold uppercase text-[var(--md-sys-color-primary)]">{stats.engine}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-white/60">Resolution:</span>
            <span>{stats.resolution || 'Probing...'}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-white/60">Bitrate:</span>
            <span>{typeof stats.bitrate === 'number' && !Number.isNaN(stats.bitrate) ? `${(stats.bitrate / 1000000).toFixed(2)} Mbps` : 'Auto / VBR'}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-white/60">Buffer Ahead:</span>
            <span>{typeof stats.buffered === 'number' && !Number.isNaN(stats.buffered) ? `${stats.buffered}s` : 'N/A'}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-white/60">Dropped Frames:</span>
            <span>{typeof stats.droppedFrames === 'number' && !Number.isNaN(stats.droppedFrames) ? stats.droppedFrames : 0}</span>
          </div>

          <div className="pt-2 border-t border-white/10">
            <span className="text-white/60 block mb-0.5">Stream Source:</span>
            <span className="text-white/80 break-all text-[10px] leading-tight block">{maskedUrl}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
