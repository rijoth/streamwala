import React from 'react';
import { Channel, Program } from '../../domain/types.ts';
import { Icon } from '../../shared/icons/index.ts';

export interface NowNextBannerProps {
  channel: Channel;
  currentProgram?: Program;
  nextProgram?: Program;
  resolution?: string;
  isVisible: boolean;
}

export const NowNextBanner: React.FC<NowNextBannerProps> = ({
  channel,
  currentProgram,
  nextProgram,
  resolution,
  isVisible,
}) => {
  if (!isVisible) return null;

  const now = Date.now();
  let progressPercent = 0;
  let timeRemaining = '';

  if (
    currentProgram &&
    typeof currentProgram.start === 'number' &&
    typeof currentProgram.stop === 'number' &&
    !Number.isNaN(currentProgram.start) &&
    !Number.isNaN(currentProgram.stop) &&
    currentProgram.stop > currentProgram.start
  ) {
    const elapsed = Math.max(0, now - currentProgram.start);
    const duration = currentProgram.stop - currentProgram.start;
    if (duration > 0) {
      const calcPercent = Math.round((elapsed / duration) * 100);
      progressPercent = !Number.isNaN(calcPercent) ? Math.min(100, Math.max(0, calcPercent)) : 0;
      const remainingMinutes = Math.max(0, Math.round((currentProgram.stop - now) / 60000));
      timeRemaining = !Number.isNaN(remainingMinutes) ? `${remainingMinutes}m left` : '';
    }
  }

  const formatTime = (ts: number | undefined) => {
    if (!ts || typeof ts !== 'number' || Number.isNaN(ts)) return '';
    try {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const hasValidChannelNumber = typeof channel.number === 'number' && !Number.isNaN(channel.number);

  return (
    <div className="fixed bottom-10 left-12 right-12 z-40 animate-slide-up pointer-events-none">
      <div className="bg-black/90 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col gap-4 text-white max-w-5xl mx-auto">
        {/* Top header row: Channel info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {channel.logo ? (
              <img
                src={channel.logo}
                alt={channel.name}
                className="w-14 h-14 object-contain rounded-xl bg-white/5 p-1 border border-white/10"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center font-bold text-xl">
                {channel.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div>
              <div className="flex items-center gap-3">
                {hasValidChannelNumber && (
                  <span className="font-mono font-bold text-2xl text-[var(--md-sys-color-primary)]">
                    {channel.number}
                  </span>
                )}
                <h2 className="font-bold text-2xl tracking-tight">{channel.name}</h2>
                {channel.isFavorite && (
                  <Icon name="star" size={20} filled className="text-amber-400" />
                )}
              </div>
              <p className="text-xs text-white/60 font-medium">{channel.groupName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {resolution && (
              <span className="px-2.5 py-1 rounded-lg bg-white/10 text-xs font-mono font-semibold tracking-wider uppercase border border-white/10">
                {resolution}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-lg bg-red-600/80 text-xs font-bold tracking-wider uppercase text-white animate-pulse">
              LIVE
            </span>
          </div>
        </div>

        {/* Current & Next Programs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-white/10">
          {/* NOW */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-[var(--md-sys-color-primary)] font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--md-sys-color-primary)] inline-block" />
                Now Playing
              </span>
              {currentProgram && (
                <span className="font-mono text-white/70">
                  {formatTime(currentProgram.start)} – {formatTime(currentProgram.stop)} ({timeRemaining})
                </span>
              )}
            </div>

            <h3 className="font-semibold text-lg text-white truncate">
              {currentProgram?.title || 'Live Stream Broadcast'}
            </h3>

            {currentProgram?.description && (
              <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">
                {currentProgram.description}
              </p>
            )}

            {/* Program progress bar */}
            {currentProgram && (
              <div className="w-full h-1.5 rounded-full bg-white/20 overflow-hidden mt-1">
                <div
                  className="h-full bg-[var(--md-sys-color-primary)] rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>

          {/* NEXT */}
          <div className="flex flex-col gap-1.5 opacity-80">
            <div className="flex items-center justify-between text-xs text-white/50 font-semibold uppercase tracking-wider">
              <span>Up Next</span>
              {nextProgram && (
                <span className="font-mono text-white/60">
                  {formatTime(nextProgram.start)} – {formatTime(nextProgram.stop)}
                </span>
              )}
            </div>

            <h3 className="font-semibold text-base text-white/90 truncate">
              {nextProgram?.title || 'Program Schedule Unavailable'}
            </h3>

            {nextProgram?.description && (
              <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">
                {nextProgram.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
