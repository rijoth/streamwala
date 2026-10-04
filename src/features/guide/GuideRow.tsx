import React from 'react';
import type { Channel, Program } from '../../domain/types.ts';
import { useFocusable } from '../../shared/focus/index.ts';
import type { GuideProgramLayout } from './guideLayout.ts';

export const GUIDE_ROW_MIN_HEIGHT = '4.5rem';

export interface GuideRowProps {
  channel: Channel;
  index: number;
  layouts: GuideProgramLayout[];
  columnWidth: number;
  onSelectProgram: (program: Program) => void;
  onSelectChannel: () => void;
}

const ProgramCell: React.FC<{
  layout: GuideProgramLayout;
  columnWidth: number;
  onSelect: () => void;
}> = ({ layout, columnWidth, onSelect }) => {
  const { ref, focused } = useFocusable({
    focusKey: `EPG_PROG_${layout.program.id}`,
    onEnterPress: onSelect,
  });

  const format = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-scroll-x={layout.x}
      data-scroll-col={Math.floor(layout.x / columnWidth)}
      onClick={onSelect}
      style={{ position: 'absolute', left: layout.x, width: layout.width, top: 0, bottom: 0 }}
      className={`
        tv-focus-target flex flex-col justify-center gap-0.5 px-2 border-r border-[var(--md-sys-color-outline-variant)]
        cursor-pointer outline-none overflow-hidden
        ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] !bg-[var(--md-sys-color-primary-container)] !text-[var(--md-sys-color-on-primary-container)] z-10' : ''}
      `}
    >
      <div className="text-xs font-semibold truncate leading-tight">{layout.program.title}</div>
      <div className="text-[10px] font-mono truncate text-[var(--md-sys-color-outline)]">
        {format(layout.clippedStart)}
      </div>
    </div>
  );
};

const EmptyCell: React.FC<{
  channel: Channel;
  columnWidth: number;
  onSelect: () => void;
}> = ({ channel, columnWidth, onSelect }) => {
  const { ref, focused } = useFocusable({
    focusKey: `EPG_EMPTY_${channel.id}`,
    onEnterPress: onSelect,
  });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-scroll-x={0}
      data-scroll-col={0}
      onClick={onSelect}
      style={{ position: 'absolute', left: 0, width: columnWidth * 2, top: 0, bottom: 0 }}
      className={`
        tv-focus-target flex items-center px-3 text-xs text-[var(--md-sys-color-outline)]
        cursor-pointer outline-none overflow-hidden
        ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] !bg-[var(--md-sys-color-primary-container)]' : ''}
      `}
    >
      No program information
    </div>
  );
};

export const GuideRow: React.FC<GuideRowProps> = ({
  channel,
  index,
  layouts,
  columnWidth,
  onSelectProgram,
  onSelectChannel,
}) => (
  <div
    data-scroll-index={index}
    className="relative border-b border-[var(--md-sys-color-outline-variant)]"
    style={{ minHeight: GUIDE_ROW_MIN_HEIGHT }}
  >
    {layouts.length === 0 ? (
      <EmptyCell channel={channel} columnWidth={columnWidth} onSelect={onSelectChannel} />
    ) : (
      layouts.map((layout) => (
        <ProgramCell
          key={layout.program.id}
          layout={layout}
          columnWidth={columnWidth}
          onSelect={() => onSelectProgram(layout.program)}
        />
      ))
    )}
  </div>
);
