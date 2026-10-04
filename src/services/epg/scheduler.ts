/**
 * EPG refresh scheduler. Pure of DOM: timers, clock and the refresh call are
 * injected so it is unit-testable with fake timers. Guarantees one refresh at a
 * time per source, dedupes concurrent requests, and backs off exponentially on
 * failure. `stop()` aborts in-flight refreshes and cancels all timers.
 */

import type { EpgSource } from '../../domain/types.ts';
import type { EpgRepository } from './repository.ts';

export type EpgSchedulePhase = 'idle' | 'running' | 'ready' | 'failed';

export interface EpgScheduleStatus {
  phase: EpgSchedulePhase;
  attempts: number;
  nextAt?: number;
  error?: string;
}

export interface EpgSchedulerOptions {
  repository: EpgRepository;
  refreshSource: (source: EpgSource, signal: AbortSignal) => Promise<void>;
  ttlHours?: number;
  now?: () => number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
  onStatus?: (sourceId: string, status: EpgScheduleStatus) => void;
}

export interface EpgScheduler {
  schedule(playlistId: string): Promise<void>;
  refreshNow(playlistId: string, sourceId?: string): Promise<void>;
  stop(): void;
  getStatus(sourceId: string): EpgScheduleStatus;
  isRefreshing(sourceId: string): boolean;
}

const IDLE: EpgScheduleStatus = { phase: 'idle', attempts: 0 };

export function createEpgScheduler(options: EpgSchedulerOptions): EpgScheduler {
  const {
    repository,
    refreshSource,
    ttlHours = 12,
    now = () => Date.now(),
    baseBackoffMs = 30_000,
    maxBackoffMs = 30 * 60_000,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (handle) => clearTimeout(handle),
    onStatus,
  } = options;

  const ttlMs = ttlHours * 3_600_000;
  const running = new Map<string, Promise<void>>();
  const controllers = new Map<string, AbortController>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const statuses = new Map<string, EpgScheduleStatus>();
  let stopped = false;

  const setStatus = (sourceId: string, status: EpgScheduleStatus) => {
    statuses.set(sourceId, status);
    onStatus?.(sourceId, status);
  };

  const clearTimerFor = (sourceId: string) => {
    const handle = timers.get(sourceId);
    if (handle !== undefined) {
      clearTimer(handle);
      timers.delete(sourceId);
    }
  };

  const scheduleTimerFor = (source: EpgSource, delayMs: number) => {
    clearTimerFor(source.id);
    timers.set(
      source.id,
      setTimer(() => {
        timers.delete(source.id);
        void run(source);
      }, delayMs)
    );
  };

  const run = (source: EpgSource): Promise<void> => {
    const existing = running.get(source.id);
    if (existing) return existing;

    const controller = new AbortController();
    controllers.set(source.id, controller);
    const attempts = statuses.get(source.id)?.attempts ?? 0;
    setStatus(source.id, { phase: 'running', attempts });

    const promise = (async () => {
      try {
        await refreshSource(source, controller.signal);
        if (stopped) return;
        setStatus(source.id, { phase: 'ready', attempts: 0 });
        scheduleTimerFor(source, ttlMs);
      } catch (error) {
        if (stopped) return;
        const nextAttempts = attempts + 1;
        const backoff = Math.min(maxBackoffMs, baseBackoffMs * 2 ** attempts);
        setStatus(source.id, {
          phase: 'failed',
          attempts: nextAttempts,
          nextAt: now() + backoff,
          error: error instanceof Error ? error.message : String(error),
        });
        scheduleTimerFor(source, backoff);
      } finally {
        running.delete(source.id);
        controllers.delete(source.id);
      }
    })();

    running.set(source.id, promise);
    return promise;
  };

  const scheduleSource = (source: EpgSource) => {
    if (stopped || !source.enabled) return;
    const status = statuses.get(source.id);
    if (status?.phase === 'running') return;
    const lastUpdated = source.lastUpdatedAt ?? source.lastFetchedAt;
    const due =
      status?.phase === 'failed' && status.nextAt
        ? status.nextAt
        : lastUpdated !== undefined
          ? lastUpdated + ttlMs
          : now();
    const delay = Math.max(0, due - now());
    if (delay <= 0) void run(source);
    else scheduleTimerFor(source, delay);
  };

  return {
    async schedule(playlistId) {
      stopped = false;
      const sources = await repository.listSources(playlistId);
      for (const source of sources) scheduleSource(source);
    },
    async refreshNow(playlistId, sourceId) {
      stopped = false;
      const sources = await repository.listSources(playlistId);
      const targets = sourceId
        ? sources.filter((s) => s.id === sourceId)
        : sources.filter((s) => s.enabled);
      for (const source of targets) {
        clearTimerFor(source.id);
        await run(source);
      }
    },
    stop() {
      stopped = true;
      for (const handle of timers.values()) clearTimer(handle);
      timers.clear();
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
    },
    getStatus(sourceId) {
      return statuses.get(sourceId) ?? IDLE;
    },
    isRefreshing(sourceId) {
      return running.has(sourceId);
    },
  };
}
