import React, { useCallback, useMemo, useState } from 'react';
import type { Channel, Program } from '../../domain/types.ts';
import { useEpgRuntime } from '../../app/epgRuntime.tsx';
import { useSettingsStore } from '../../app/settingsStore.ts';
import { FocusZone } from '../../shared/focus/index.ts';
import { Button, Chip, LinearProgress } from '../../shared/ui/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import {
  VirtualGrid,
  clamp,
  maxOffset,
  useFocusedItemIndex,
  useGridScroller,
  useScrollAxis,
  useVirtualWindow,
} from '../../shared/scroll/index.ts';
import { EpgMirror } from './EpgMirror.tsx';
import { ProgramDetailsSheet } from './ProgramDetailsSheet.tsx';
import { GuideRow } from './GuideRow.tsx';
import { useGuidePrograms } from './useGuidePrograms.ts';
import {
  GUIDE_COLUMNS,
  GUIDE_COLUMN_MS,
  guideDayEnd,
  guideDayStart,
  layoutPrograms,
  timeToX,
} from './guideLayout.ts';

const CHANNEL_COL_WIDTH = 208;
const ROW_HEIGHT = 72;
const COLUMN_WIDTH = 96;
const DAY_CHOICES = [-1, 0, 1, 2, 3];

export interface EpgGuideViewProps {
  channels: Channel[];
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite?: (channelId: string) => void;
  onOpenSettings?: () => void;
}

function dayLabel(offset: number): string {
  if (offset === 0) return 'Today';
  if (offset === -1) return 'Yesterday';
  if (offset === 1) return 'Tomorrow';
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
}

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const EpgGuideView: React.FC<EpgGuideViewProps> = ({
  channels,
  onSelectChannel,
  onToggleFavorite,
  onOpenSettings,
}) => {
  const runtime = useEpgRuntime();
  const { settings } = useSettingsStore();
  const [dayOffset, setDayOffset] = useState(0);
  const [selected, setSelected] = useState<{ program: Program; channel: Channel } | null>(null);
  const [reminders, setReminders] = useState<Set<string>>(new Set());
  const [favoriteOverrides, setFavoriteOverrides] = useState<Record<string, boolean>>({});

  const now = Date.now();
  const dayStart = guideDayStart(now, dayOffset);
  const dayEnd = guideDayEnd(dayStart);
  const { programs, loading } = useGuidePrograms(channels, dayStart, dayEnd);

  const vScroller = useGridScroller({
    screenKey: 'guide',
    count: channels.length,
    rowSize: ROW_HEIGHT,
    minItemWidth: 1000,
    gap: 0,
    columns: 1,
    measureItemHeight: true,
  });
  const hAxis = useScrollAxis({ orientation: 'horizontal' });
  const timelineWidth = GUIDE_COLUMNS * COLUMN_WIDTH;
  const verticalWindow = useVirtualWindow(vScroller.axis, vScroller.rowSize, channels.length, 2);

  useFocusedItemIndex(hAxis.viewportRef, (info) => {
    const target = clamp(
      info.x - hAxis.getViewportSize() / 3,
      0,
      maxOffset(hAxis.getContentSize(), hAxis.getViewportSize())
    );
    hAxis.scrollToOffset(target, { animate: true });
  });

  const layoutsByChannel = useMemo(() => {
    const map = new Map<string, ReturnType<typeof layoutPrograms>>();
    for (const channel of channels) {
      map.set(channel.id, layoutPrograms(programs.get(channel.id) ?? [], dayStart, dayEnd, COLUMN_WIDTH));
    }
    return map;
  }, [channels, programs, dayStart, dayEnd]);

  const jumpToNow = useCallback(() => {
    setDayOffset(0);
    requestAnimationFrame(() => {
      const start = guideDayStart(Date.now(), 0);
      const x = timeToX(Date.now(), start, guideDayEnd(start), COLUMN_WIDTH);
      hAxis.scrollToOffset(
        clamp(x - hAxis.getViewportSize() / 3, 0, maxOffset(hAxis.getContentSize(), hAxis.getViewportSize())),
        { animate: true }
      );
    });
  }, [hAxis]);

  const nowX = dayOffset === 0 ? timeToX(now, dayStart, dayEnd, COLUMN_WIDTH) : null;
  const statusValues = Object.values(runtime?.statuses ?? {});
  const anyRunning = statusValues.some((s) => s.phase === 'running');
  const anyFailed = statusValues.some((s) => s.phase === 'failed');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden text-[var(--md-sys-color-on-surface)] p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Program Guide</h2>
          <p className="text-xs text-[var(--md-sys-color-outline)]">
            D-pad to move. OK opens program details; BACK closes it first.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {runtime && runtime.sourceCount > 0 && (
            <div className="flex items-center gap-2 text-xs font-medium" aria-live="polite" data-testid="guide-status">
              <Icon
                name={anyFailed ? 'error' : anyRunning ? 'sync' : 'check_circle'}
                size={16}
                className={anyFailed ? 'text-[var(--md-sys-color-error)]' : 'text-emerald-400'}
              />
              <span>{anyFailed ? 'Guide refresh failed' : anyRunning ? 'Refreshing…' : 'Guide ready'}</span>
              <Button variant="text" className="!px-2 !py-1 text-xs" onClick={() => void runtime.refresh()}>
                Refresh
              </Button>
            </div>
          )}
          <Button variant="tonal" icon="update" onClick={jumpToNow} className="!px-3 !py-1.5 text-xs">
            Jump to now
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {DAY_CHOICES.map((offset) => (
          <Chip
            key={offset}
            label={dayLabel(offset)}
            selected={dayOffset === offset}
            focusKey={`GUIDE_DAY_${offset}`}
            onClick={() => setDayOffset(offset)}
          />
        ))}
      </div>

      {runtime && runtime.sourceCount === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          <Icon name="calendar_month" size={40} className="text-[var(--md-sys-color-outline)]" />
          <h3 className="font-semibold text-lg">No program guide attached</h3>
          <p className="text-sm text-[var(--md-sys-color-outline)] max-w-md">
            Add an XMLTV source to this playlist to see the timeline, Now/Next and program details.
          </p>
          {onOpenSettings && (
            <Button variant="filled" icon="settings" onClick={onOpenSettings}>
              Open Settings
            </Button>
          )}
        </div>
      ) : loading || anyRunning ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <LinearProgress className="max-w-sm" />
          <p className="text-sm text-[var(--md-sys-color-outline)]">Loading the guide…</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] overflow-hidden">
          <div className="flex shrink-0 border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)]">
            <div
              className="shrink-0 p-3 font-bold text-xs uppercase tracking-wider text-[var(--md-sys-color-outline)] border-r border-[var(--md-sys-color-outline-variant)]"
              style={{ width: CHANNEL_COL_WIDTH }}
            >
              Channel
            </div>
            <div className="flex-1 relative overflow-hidden">
              <EpgMirror axis={hAxis} orientation="x" className="flex">
                {Array.from({ length: GUIDE_COLUMNS }, (_, i) => (
                  <div
                    key={i}
                    className="shrink-0 p-2 text-xs font-mono font-semibold border-r border-[var(--md-sys-color-outline-variant)]"
                    style={{ width: COLUMN_WIDTH }}
                  >
                    {formatTime(dayStart + i * GUIDE_COLUMN_MS)}
                  </div>
                ))}
              </EpgMirror>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex">
            <div
              className="shrink-0 relative overflow-hidden border-r border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)]"
              style={{ width: CHANNEL_COL_WIDTH }}
            >
              <EpgMirror axis={vScroller.axis} orientation="y">
                <div className="relative" style={{ height: channels.length * vScroller.rowSize }}>
                  {channels.slice(verticalWindow.start, verticalWindow.end).map((channel, i) => {
                    const row = verticalWindow.start + i;
                    return (
                      <div
                        key={channel.id}
                        className="absolute left-0 flex items-center gap-3 px-3 border-b border-[var(--md-sys-color-outline-variant)]"
                        style={{ top: row * vScroller.rowSize, height: vScroller.itemHeight, width: '100%' }}
                      >
                        {channel.logo ? (
                          <img
                            src={channel.logo}
                            alt={channel.name}
                            className="w-7 h-7 object-contain rounded shrink-0"
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
                    );
                  })}
                </div>
              </EpgMirror>
            </div>

            <FocusZone focusKey="EPG_GRID" ownsChildren className="flex-1 min-w-0">
              <div ref={hAxis.viewportRef} data-scroll-axis="horizontal" className="relative h-full overflow-hidden">
                <div
                  ref={hAxis.contentRef}
                  className="relative h-full will-change-transform"
                  style={{ width: timelineWidth }}
                >
                  <div ref={vScroller.axis.viewportRef} data-scroll-axis="vertical" className="h-full overflow-hidden">
                    <VirtualGrid<Channel>
                      axis={vScroller.axis}
                      items={channels}
                      columns={1}
                      itemHeight={vScroller.itemHeight}
                      gap={0}
                      className="relative"
                      getKey={(channel) => channel.id}
                      renderItem={(channel, index) => (
                        <GuideRow
                          channel={channel}
                          index={index}
                          columnWidth={COLUMN_WIDTH}
                          layouts={layoutsByChannel.get(channel.id) ?? []}
                          onSelectProgram={(program) => setSelected({ program, channel })}
                          onSelectChannel={() => onSelectChannel(channel)}
                        />
                      )}
                    />
                  </div>
                  {nowX !== null && nowX >= 0 && nowX <= timelineWidth && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                      style={{ left: nowX }}
                    />
                  )}
                </div>
              </div>
            </FocusZone>
          </div>
        </div>
      )}

      <ProgramDetailsSheet
        isOpen={selected !== null}
        program={selected?.program ?? null}
        channel={selected?.channel ?? null}
        isFavorite={
          selected ? favoriteOverrides[selected.channel.id] ?? !!selected.channel.isFavorite : false
        }
        remindersEnabled={settings.epgRemindersEnabled}
        reminderSet={selected ? reminders.has(selected.program.id) : false}
        onClose={() => setSelected(null)}
        onWatch={() => {
          if (selected) onSelectChannel(selected.channel);
          setSelected(null);
        }}
        onToggleFavorite={() => {
          if (!selected) return;
          const next = !(favoriteOverrides[selected.channel.id] ?? !!selected.channel.isFavorite);
          setFavoriteOverrides((prev) => ({ ...prev, [selected.channel.id]: next }));
          onToggleFavorite?.(selected.channel.id);
        }}
        onToggleReminder={() => {
          if (!selected) return;
          setReminders((prev) => {
            const next = new Set(prev);
            if (next.has(selected.program.id)) next.delete(selected.program.id);
            else next.add(selected.program.id);
            return next;
          });
        }}
      />
    </div>
  );
};
