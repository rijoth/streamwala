import React, { useCallback, useEffect, useState } from 'react';
import { Channel, Program } from '../../domain/types.ts';
import { getProgramsForChannel } from '../../services/storage/db.ts';
import { FocusZone, useFocusable } from '../../shared/focus/index.ts';
import { SideSheet, Button } from '../../shared/ui/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import {
  DEFAULT_SCROLL_CONFIG,
  clamp,
  maxOffset,
  rowSnapOffset,
  useFocusedItemIndex,
  useScrollAxis,
  type FocusedItemInfo,
} from '../../shared/scroll/index.ts';
import { EpgMirror } from './EpgMirror.tsx';

export interface EpgGuideViewProps {
  channels: Channel[];
  onSelectChannel: (channel: Channel) => void;
}

const ROW_HEIGHT = 64;
const CHANNEL_COL_WIDTH = 192;
const SLOT_WIDTH = 192;
const SLOT_MS = 1_800_000;
const VISIBLE_CHANNEL_LIMIT = 30;

export const EpgGuideView: React.FC<EpgGuideViewProps> = ({ channels, onSelectChannel }) => {
  const [selectedProgram, setSelectedProgram] = useState<{ program: Program; channel: Channel } | null>(null);
  const [channelPrograms, setChannelPrograms] = useState<Map<string, Program[]>>(new Map());

  const now = Date.now();
  const startTime = Math.floor(now / SLOT_MS) * SLOT_MS - SLOT_MS;
  const endTime = startTime + 5 * 3_600_000;
  const timeSlots: number[] = [];
  for (let t = startTime; t < endTime; t += SLOT_MS) timeSlots.push(t);

  const visibleChannels = channels.slice(0, VISIBLE_CHANNEL_LIMIT);
  const timelineWidth = timeSlots.length * SLOT_WIDTH;

  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      const map = new Map<string, Program[]>();
      for (const ch of visibleChannels) {
        const progs = await getProgramsForChannel(ch.id, startTime, endTime);
        map.set(ch.id, progs);
      }
      if (isMounted) setChannelPrograms(map);
    };
    fetchAll();
    return () => {
      isMounted = false;
    };
  }, [channels, startTime]);

  const vAxis = useScrollAxis({ orientation: 'vertical' });
  const hAxis = useScrollAxis({ orientation: 'horizontal' });

  const handleVerticalFocus = useCallback(
    (info: FocusedItemInfo) => {
      const target = rowSnapOffset(
        info.row * ROW_HEIGHT,
        vAxis.getViewportSize(),
        vAxis.getContentSize(),
        DEFAULT_SCROLL_CONFIG
      );
      vAxis.scrollToOffset(target, { animate: true });
    },
    [vAxis]
  );

  const handleHorizontalFocus = useCallback(
    (info: FocusedItemInfo) => {
      const target = clamp(
        info.x - SLOT_WIDTH / 2,
        0,
        maxOffset(hAxis.getContentSize(), hAxis.getViewportSize())
      );
      hAxis.scrollToOffset(target, { animate: true });
    },
    [hAxis]
  );

  useFocusedItemIndex(vAxis.viewportRef, handleVerticalFocus);
  useFocusedItemIndex(hAxis.viewportRef, handleHorizontalFocus);

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const nowX = clamp(Math.round(((now - startTime) / SLOT_MS) * SLOT_WIDTH), 0, timelineWidth);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden text-[var(--md-sys-color-on-surface)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Electronic Program Guide (EPG)</h2>
          <p className="text-xs text-[var(--md-sys-color-outline)]">
            Navigate timeline with remote D-pad. Press OK to view details or watch.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[var(--md-sys-color-primary)]">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>CURRENT TIME: {formatTime(now)}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] overflow-hidden">
        {/* Time header, pinned vertically and mirrored horizontally. */}
        <div className="flex shrink-0 border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)]">
          <div
            className="shrink-0 p-3 font-bold text-xs uppercase tracking-wider text-[var(--md-sys-color-outline)] border-r border-[var(--md-sys-color-outline-variant)]"
            style={{ width: CHANNEL_COL_WIDTH }}
          >
            Channel
          </div>
          <div className="flex-1 relative overflow-hidden">
            <EpgMirror axis={hAxis} orientation="x" className="flex" >
              {timeSlots.map((slot) => (
                <div
                  key={slot}
                  className="shrink-0 p-3 text-xs font-mono font-semibold border-r border-[var(--md-sys-color-outline-variant)]"
                  style={{ width: SLOT_WIDTH }}
                >
                  {formatTime(slot)}
                </div>
              ))}
            </EpgMirror>
          </div>
        </div>

        {/* Body: pinned channel column + two-axis program grid. */}
        <div className="flex-1 min-h-0 flex">
          <div
            className="shrink-0 relative overflow-hidden border-r border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)]"
            style={{ width: CHANNEL_COL_WIDTH }}
          >
            <EpgMirror axis={vAxis} orientation="y">
              {visibleChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center gap-3 p-3 border-b border-[var(--md-sys-color-outline-variant)]"
                  style={{ height: ROW_HEIGHT }}
                >
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={channel.name}
                      className="w-7 h-7 object-contain rounded shrink-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-7 h-7 rounded bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center text-xs font-bold shrink-0">
                      {channel.name.slice(0, 2)}
                    </div>
                  )}
                  <div className="truncate">
                    <div className="text-xs font-bold truncate">{channel.name}</div>
                    <div className="text-[10px] text-[var(--md-sys-color-outline)] font-mono">
                      CH {typeof channel.number === 'number' && !Number.isNaN(channel.number) ? channel.number : '•'}
                    </div>
                  </div>
                </div>
              ))}
            </EpgMirror>
          </div>

          <div ref={vAxis.viewportRef} data-scroll-axis="vertical" className="flex-1 relative overflow-hidden">
            <div
              ref={vAxis.contentRef}
              className="will-change-transform"
              style={{ height: visibleChannels.length * ROW_HEIGHT }}
            >
              <div ref={hAxis.viewportRef} data-scroll-axis="horizontal" className="h-full relative overflow-hidden">
                <div
                  ref={hAxis.contentRef}
                  className="will-change-transform relative"
                  style={{ width: timelineWidth }}
                >
                  <FocusZone focusKey="EPG_GRID" className="relative">
                    {visibleChannels.map((channel, rowIndex) => {
                      const progs = channelPrograms.get(channel.id) || [];
                      return (
                        <div
                          key={channel.id}
                          data-scroll-row={rowIndex}
                          className="flex border-b border-[var(--md-sys-color-outline-variant)]"
                          style={{ height: ROW_HEIGHT }}
                        >
                          {progs.length > 0 ? (
                            progs.map((program, colIndex) => {
                              const start =
                                typeof program.start === 'number' && !Number.isNaN(program.start)
                                  ? program.start
                                  : startTime;
                              const stop =
                                typeof program.stop === 'number' && !Number.isNaN(program.stop)
                                  ? program.stop
                                  : start + SLOT_MS;
                              const durationMinutes = Math.max(15, Math.round((stop - start) / 60000));
                              const widthPx = Math.max(
                                SLOT_WIDTH,
                                Math.round((durationMinutes / 30) * SLOT_WIDTH)
                              );
                              const x = Math.max(0, Math.round(((start - startTime) / SLOT_MS) * SLOT_WIDTH));
                              return (
                                <EpgProgramCell
                                  key={program.id}
                                  program={program}
                                  widthPx={widthPx}
                                  x={x}
                                  colIndex={colIndex}
                                  onSelect={() => setSelectedProgram({ program, channel })}
                                />
                              );
                            })
                          ) : (
                            <EpgProgramCell
                              program={{
                                id: `empty_${channel.id}`,
                                channelId: channel.id,
                                title: 'Live Stream Broadcast',
                                start: startTime,
                                stop: endTime,
                                description: 'Real-time transmission.',
                              }}
                              widthPx={timelineWidth}
                              x={0}
                              colIndex={0}
                              onSelect={() => onSelectChannel(channel)}
                            />
                          )}
                        </div>
                      );
                    })}
                    {/* "Now" indicator scrolls horizontally with the timeline. */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                      style={{ left: nowX }}
                    />
                  </FocusZone>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SideSheet
        isOpen={!!selectedProgram}
        onClose={() => setSelectedProgram(null)}
        title={selectedProgram?.program.title || 'Program Information'}
        icon="info"
      >
        {selectedProgram && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--md-sys-color-surface-container-high)]">
              {selectedProgram.channel.logo && (
                <img
                  src={selectedProgram.channel.logo}
                  alt={selectedProgram.channel.name}
                  className="w-10 h-10 object-contain rounded-lg"
                />
              )}
              <div>
                <h4 className="font-bold text-base">{selectedProgram.channel.name}</h4>
                <p className="text-xs text-[var(--md-sys-color-outline)] font-mono">
                  {formatTime(selectedProgram.program.start)} – {formatTime(selectedProgram.program.stop)}
                </p>
              </div>
            </div>

            {selectedProgram.program.category && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--md-sys-color-outline)] font-semibold">Category:</span>
                <span className="text-xs font-medium text-[var(--md-sys-color-primary)]">
                  {selectedProgram.program.category}
                </span>
              </div>
            )}

            <p className="text-sm leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
              {selectedProgram.program.description || 'No detailed synopsis available for this program.'}
            </p>

            <div className="pt-4 mt-auto">
              <Button
                variant="filled"
                icon="play_arrow"
                autoFocus
                onClick={() => {
                  onSelectChannel(selectedProgram.channel);
                  setSelectedProgram(null);
                }}
                className="w-full !py-3.5"
              >
                Watch Channel Now
              </Button>
            </div>
          </div>
        )}
      </SideSheet>
    </div>
  );
};

interface EpgProgramCellProps {
  program: Program;
  widthPx: number;
  x: number;
  colIndex: number;
  onSelect: () => void;
}

const EpgProgramCell: React.FC<EpgProgramCellProps> = ({ program, widthPx, x, colIndex, onSelect }) => {
  const { ref, focused } = useFocusable({ onEnterPress: onSelect });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-scroll-col={colIndex}
      data-scroll-x={x}
      onClick={onSelect}
      style={{ width: `${widthPx}px` }}
      className={`
        tv-focus-target shrink-0 p-3 h-16 border-r border-[var(--md-sys-color-outline-variant)]
        cursor-pointer outline-none flex flex-col justify-center overflow-hidden
        ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] !bg-[var(--md-sys-color-primary-container)] !text-[var(--md-sys-color-on-primary-container)] z-10' : ''}
      `}
    >
      <div className="text-xs font-semibold truncate leading-tight">{program.title}</div>
      {program.description && (
        <div className="text-[10px] text-[var(--md-sys-color-outline)] truncate mt-0.5">{program.description}</div>
      )}
    </div>
  );
};
