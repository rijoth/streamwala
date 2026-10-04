import React from 'react';
import { Channel } from '../../domain/types.ts';
import { FocusZone } from '../../shared/focus/index.ts';
import { Button } from '../../shared/ui/index.ts';
import { Icon } from '../../shared/icons/index.ts';

export interface HeroSectionProps {
  channel: Channel;
  expanded: boolean;
  onWatch: () => void;
  onGuide: () => void;
}

/**
 * Home hero with two discrete states.
 *
 * A *single* DOM tree is toggled with classes only: no branch renders different
 * elements, so a focused sibling is never remounted when the hero collapses
 * (which used to drop DOM focus to `<body>`). Only `opacity`/`transform` and
 * display state animate; the hero is never rendered half-clipped.
 */
export const HeroSection: React.FC<HeroSectionProps> = ({ channel, expanded, onWatch, onGuide }) => (
  <section data-scroll-row={0} data-hero-state={expanded ? 'expanded' : 'collapsed'}>
    <div
      className={`
        relative rounded-3xl overflow-hidden border border-[var(--md-sys-color-outline-variant)] shadow-2xl
        bg-gradient-to-r from-blue-950/80 via-slate-900/60 to-black/80
        transition-opacity duration-200
        ${expanded ? 'p-8 min-h-[260px] flex flex-col justify-end' : 'px-6 h-[84px] flex items-center'}
      `}
    >
      <div
        className={`absolute top-0 right-0 w-96 h-full pointer-events-none flex items-center justify-center transition-opacity duration-200 ${
          expanded ? 'opacity-20' : 'opacity-0'
        }`}
      >
        {channel.logo ? (
          <img src={channel.logo} alt="" className="w-64 h-64 object-contain filter grayscale" />
        ) : (
          <Icon name="live_tv" size={140} />
        )}
      </div>

      <div
        className={`relative z-10 ${
          expanded ? 'max-w-xl space-y-3' : 'flex items-center gap-3 min-w-0 w-full'
        }`}
      >
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2.5 py-0.5 rounded-full bg-red-600/90 text-white text-[11px] font-bold tracking-wider uppercase ${
              expanded ? 'animate-pulse' : ''
            }`}
          >
            Featured Live
          </span>
          <span className="text-xs text-[var(--md-sys-color-primary)] font-semibold truncate">
            {channel.groupName}
          </span>
        </div>

        <h1
          className={`font-extrabold tracking-tight truncate ${
            expanded ? 'text-3xl md:text-4xl' : 'text-lg'
          }`}
        >
          {channel.name}
        </h1>

        <p
          className={`text-sm text-[var(--md-sys-color-on-surface-variant)] leading-relaxed ${
            expanded ? '' : 'hidden'
          }`}
        >
          Experience seamless, instant 10-foot live streaming with hardware acceleration and
          automatic stream recovery.
        </p>

        <FocusZone
          focusKey="HERO_ACTIONS"
          className={`flex items-center gap-3 ${expanded ? 'pt-2' : 'ml-auto shrink-0'}`}
        >
          <Button
            variant="filled"
            icon="play_arrow"
            focusKey="HERO_WATCH"
            autoFocus
            onClick={onWatch}
            className={expanded ? '!px-8 !py-3.5 shadow-xl' : '!px-6 !py-2.5'}
          >
            Watch Now
          </Button>
          <Button
            variant="tonal"
            icon="calendar_month"
            focusKey="HERO_GUIDE"
            onClick={onGuide}
            className={`!px-6 !py-3.5 ${expanded ? '' : 'hidden'}`}
          >
            EPG Guide
          </Button>
        </FocusZone>
      </div>
    </div>
  </section>
);
