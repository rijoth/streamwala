import React, { useState, useEffect } from 'react';
import { Channel, Program } from '../../domain/types.ts';
import { getProgramsForChannel } from '../../services/storage/db.ts';
import { FocusZone, useFocusable } from '../../shared/focus/index.ts';
import { SideSheet, Button } from '../../shared/ui/index.ts';
import { Icon } from '../../shared/icons/index.ts';

export interface EpgGuideViewProps {
  channels: Channel[];
  onSelectChannel: (channel: Channel) => void;
}

export const EpgGuideView: React.FC<EpgGuideViewProps> = ({
  channels,
  onSelectChannel,
}) => {
  const [selectedProgram, setSelectedProgram] = useState<{ program: Program; channel: Channel } | null>(null);
  const [channelPrograms, setChannelPrograms] = useState<Map<string, Program[]>>(new Map());

  // Base timeline: current hour minus 30 mins, up to +4 hours
  const now = Date.now();
  const startTime = Math.floor(now / 1800000) * 1800000 - 1800000;
  const timeSlots: number[] = [];
  for (let t = startTime; t < startTime + 5 * 3600000; t += 1800000) {
    timeSlots.push(t);
  }

  // Fetch programs for visible channels
  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      const map = new Map<string, Program[]>();
      for (const ch of channels.slice(0, 30)) {
        const progs = await getProgramsForChannel(ch.id, startTime, startTime + 5 * 3600000);
        map.set(ch.id, progs);
      }
      if (isMounted) {
        setChannelPrograms(map);
      }
    };

    fetchAll();
    return () => { isMounted = false; };
  }, [channels, startTime]);

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden text-[var(--md-sys-color-on-surface)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Electronic Program Guide (EPG)</h2>
          <p className="text-xs text-[var(--md-sys-color-outline)]">Navigate timeline with remote D-pad. Press OK to view details or watch.</p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[var(--md-sys-color-primary)]">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>CURRENT TIME: {formatTime(now)}</span>
        </div>
      </div>

      {/* Timeline Grid Container */}
      <div className="flex-1 overflow-auto rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)]">
        {/* Header: Time slots */}
        <div className="flex sticky top-0 z-20 bg-[var(--md-sys-color-surface-container-high)] border-b border-[var(--md-sys-color-outline-variant)]">
          <div className="w-48 shrink-0 p-3 font-bold text-xs uppercase tracking-wider text-[var(--md-sys-color-outline)] border-r border-[var(--md-sys-color-outline-variant)]">
            Channel
          </div>
          <div className="flex-1 flex min-w-[1200px]">
            {timeSlots.map((slot) => (
              <div
                key={slot}
                className="w-48 shrink-0 p-3 text-xs font-mono font-semibold border-r border-[var(--md-sys-color-outline-variant)]"
              >
                {formatTime(slot)}
              </div>
            ))}
          </div>
        </div>

        {/* Channels Rows */}
        <FocusZone focusKey="EPG_GRID" className="flex flex-col min-w-[1392px]">
          {channels.map((channel) => {
            const progs = channelPrograms.get(channel.id) || [];

            return (
              <div
                key={channel.id}
                className="flex border-b border-[var(--md-sys-color-outline-variant)] hover:bg-[var(--md-sys-color-surface-container-low)]"
              >
                {/* Channel Label */}
                <div className="w-48 shrink-0 p-3 flex items-center gap-3 border-r border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)]">
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={channel.name}
                      className="w-7 h-7 object-contain rounded shrink-0"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
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

                {/* Programs Row */}
                <div className="flex-1 flex relative">
                  {progs.length > 0 ? (
                    progs.map((program) => {
                      const start = typeof program.start === 'number' && !Number.isNaN(program.start) ? program.start : 0;
                      const stop = typeof program.stop === 'number' && !Number.isNaN(program.stop) ? program.stop : start + 1800000;
                      const diffMins = Math.round((stop - start) / 60000);
                      const durationMinutes = !Number.isNaN(diffMins) && diffMins > 0 ? Math.max(15, diffMins) : 30;
                      const calcWidth = Math.round((durationMinutes / 30) * 192);
                      const widthPx = !Number.isNaN(calcWidth) && calcWidth > 0 ? calcWidth : 192;

                      return (
                        <EpgProgramCell
                          key={program.id}
                          program={program}
                          channel={channel}
                          widthPx={widthPx}
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
                        stop: startTime + 5 * 3600000,
                        description: 'Real-time transmission.',
                      }}
                      channel={channel}
                      widthPx={960}
                      onSelect={() => onSelectChannel(channel)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </FocusZone>
      </div>

      {/* Program Details Side Sheet */}
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
  channel: Channel;
  widthPx: number;
  onSelect: () => void;
}

const EpgProgramCell: React.FC<EpgProgramCellProps> = ({
  program,
  widthPx,
  onSelect,
}) => {
  const { ref, focused } = useFocusable({
    onEnterPress: onSelect,
  });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      onClick={onSelect}
      style={{ width: `${widthPx}px` }}
      className={`
        tv-focus-target shrink-0 p-3 h-16 border-r border-[var(--md-sys-color-outline-variant)]
        cursor-pointer outline-none transition-all duration-100 flex flex-col justify-center overflow-hidden
        hover:bg-[var(--md-sys-color-surface-container-high)]
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
