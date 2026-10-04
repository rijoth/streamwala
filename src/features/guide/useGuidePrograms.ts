import { useEffect, useState } from 'react';
import type { Channel, Program } from '../../domain/types.ts';
import { useEpgRuntime } from '../../app/epgRuntime.tsx';

export interface GuidePrograms {
  programs: Map<string, Program[]>;
  loading: boolean;
}

/**
 * Loads programmes for the visible channel set in one batched query (never the
 * full EPG), re-running on day change and after a refresh.
 */
export function useGuidePrograms(
  channels: readonly Channel[],
  dayStart: number,
  dayEnd: number
): GuidePrograms {
  const runtime = useEpgRuntime();
  const repository = runtime?.repository;
  const version = runtime?.version ?? 0;
  const channelKey = channels.map((c) => c.id).join('|');
  const [programs, setPrograms] = useState<Map<string, Program[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repository) {
      setPrograms(new Map());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const ids = channelKey ? channelKey.split('|') : [];
    void repository
      .getProgramsForChannels(ids, dayStart, dayEnd)
      .then((rows) => {
        if (cancelled) return;
        const map = new Map<string, Program[]>();
        for (const program of rows) {
          const list = map.get(program.channelId);
          if (list) list.push(program);
          else map.set(program.channelId, [program]);
        }
        setPrograms(map);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPrograms(new Map());
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repository, channelKey, dayStart, dayEnd, version]);

  return { programs, loading };
}
