import React, { useMemo, useState } from 'react';
import type { Channel } from '../../../domain/types.ts';
import { Button, Chip } from '../../../shared/ui/index.ts';
import { FocusZone } from '../../../shared/focus/index.ts';
import type { EpgMatchReportView } from '../../../services/epg/matchReport.ts';

export interface EpgMatchReportProps {
  report: EpgMatchReportView;
  channels: Channel[];
  onMap: (channel: Channel) => void;
  onUnmap: (channelId: string) => void;
}

type Filter = 'all' | 'unmatched' | 'ambiguous' | 'matched';

interface Row {
  channel: Channel;
  status: 'matched' | 'unmatched' | 'ambiguous';
  detail: string;
}

export const EpgMatchReport: React.FC<EpgMatchReportProps> = ({
  report,
  channels,
  onMap,
  onUnmap,
}) => {
  const [filter, setFilter] = useState<Filter>('all');
  const byId = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);

  const rows = useMemo<Row[]>(() => {
    const matched: Row[] = report.matched.flatMap((m) => {
      const channel = byId.get(m.channelId);
      if (!channel) return [];
      return [
        {
          channel,
          status: 'matched' as const,
          detail: `${m.method} · ${Math.round(m.confidence * 100)}% · ${m.xmltvId}`,
        },
      ];
    });

    const unmatched: Row[] = report.unmatched.map((channel) => ({
      channel,
      status: 'unmatched' as const,
      detail: 'No EPG channel matched',
    }));

    const ambiguous: Row[] = report.ambiguous.flatMap((entry) => {
      const channel = byId.get(entry.channelId);
      if (!channel) return [];
      return [
        {
          channel,
          status: 'ambiguous' as const,
          detail: `${entry.candidates.length} possible matches`,
        },
      ];
    });

    return [...matched, ...unmatched, ...ambiguous];
  }, [report, byId]);

  const visible = filter === 'all' ? rows : rows.filter((row) => row.status === filter);

  return (
    <FocusZone focusKey="EPG_MATCH_REPORT" ownsChildren className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-base">Channel match report</h4>
        <span className="text-xs text-[var(--md-sys-color-outline)]">{report.total} channels</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'All', rows.length],
            ['matched', 'Matched', report.matched.length],
            ['unmatched', 'Unmatched', report.unmatched.length],
            ['ambiguous', 'Ambiguous', report.ambiguous.length],
          ] as const
        ).map(([id, label, count]) => (
          <Chip
            key={id}
            label={label}
            badge={count}
            selected={filter === id}
            focusKey={`EPG_MATCH_FILTER_${id}`}
            onClick={() => setFilter(id)}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-[var(--md-sys-color-outline)] py-4">
          Nothing to show for this filter.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.slice(0, 100).map((row) => (
            <div
              key={row.channel.id}
              className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]"
            >
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{row.channel.name}</div>
                <div className="text-xs text-[var(--md-sys-color-outline)] truncate">
                  {row.detail}
                </div>
              </div>
              {row.status === 'matched' ? (
                <Button
                  variant="text"
                  className="!px-3 !py-1.5 text-xs shrink-0"
                  onClick={() => onUnmap(row.channel.id)}
                >
                  Unmap
                </Button>
              ) : (
                <Button
                  variant="tonal"
                  icon="link"
                  className="!px-3 !py-1.5 text-xs shrink-0"
                  onClick={() => onMap(row.channel)}
                >
                  Map
                </Button>
              )}
            </div>
          ))}
          {visible.length > 100 && (
            <p className="text-xs text-[var(--md-sys-color-outline)]">
              Showing the first 100 of {visible.length}. Use search in the mapping dialog to narrow.
            </p>
          )}
        </div>
      )}
    </FocusZone>
  );
};
