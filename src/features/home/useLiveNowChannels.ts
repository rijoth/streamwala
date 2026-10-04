import { useEffect, useState } from 'react';
import type { Channel } from '../../domain/types.ts';
import { useEpgRuntime } from '../../app/epgRuntime.tsx';

/**
 * Channels that currently have a programme airing, for the Home "Live now"
 * rail. Bounded to a sample of channels and re-evaluated on refresh/minute.
 */
export function useLiveNowChannels(channels: Channel[], limit = 15): Channel[] {
  const runtime = useEpgRuntime();
  const nowNext = runtime?.nowNext;
  const version = runtime?.version ?? 0;
  const minute = runtime?.minute ?? 0;
  const [live, setLive] = useState<Channel[]>([]);

  useEffect(() => {
    if (!nowNext) {
      setLive([]);
      return;
    }
    let cancelled = false;
    const sample = channels.slice(0, 30);
    void Promise.all(
      sample.map(async (channel) => ({
        channel,
        result: await nowNext.getNowNext(channel.id, Date.now()),
      }))
    )
      .then((results) => {
        if (cancelled) return;
        setLive(results.filter((r) => r.result.current).map((r) => r.channel).slice(0, limit));
      })
      .catch(() => {
        if (!cancelled) setLive([]);
      });
    return () => {
      cancelled = true;
    };
  }, [nowNext, channels, limit, version, minute]);

  return live;
}
