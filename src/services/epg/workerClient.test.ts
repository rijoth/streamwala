import { describe, it, expect, vi } from 'vitest';
import { startEpgParse } from './workerClient.ts';
import { EpgFetchError } from './fetcher.ts';
import type { EpgParseResult } from './parseXmltv.ts';
import type { EpgParseRequest, EpgWorkerMessage } from './workerProtocol.ts';

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  terminate = vi.fn(() => {
    this.terminated = true;
  });
  postMessage = vi.fn();

  emit(message: EpgWorkerMessage) {
    this.onmessage?.({ data: message } as MessageEvent);
  }
  fail(message: string) {
    this.onerror?.({ message } as ErrorEvent);
  }
}

const REQUEST: EpgParseRequest = {
  kind: 'text',
  sourceId: 'src1',
  text: '<tv/>',
  channels: [],
  now: 0,
};

const EMPTY_RESULT: EpgParseResult = {
  channels: [],
  matchReport: { matched: [], unmatched: [], ambiguous: [] },
  imports: [],
  stats: { bytes: 0, channels: 0, programmesKept: 0, programmesSkipped: 0, badDates: 0, errors: 0 },
};

describe('startEpgParse', () => {
  it('forwards progress and resolves the done outcome', async () => {
    const worker = new FakeWorker();
    const onProgress = vi.fn();
    const handle = startEpgParse(REQUEST, {
      createWorker: () => worker as unknown as Worker,
      onProgress,
    });

    worker.emit({
      type: 'progress',
      progress: { bytes: 10, channels: 1, programmesKept: 2, programmesSkipped: 0 },
    });
    worker.emit({ type: 'done', result: EMPTY_RESULT, notModified: false, etag: 'W/"1"' });

    const outcome = await handle.promise;
    expect(onProgress).toHaveBeenCalledWith({
      bytes: 10,
      channels: 1,
      programmesKept: 2,
      programmesSkipped: 0,
    });
    expect(outcome.result).toBe(EMPTY_RESULT);
    expect(outcome.etag).toBe('W/"1"');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('rejects a structured worker error with its kind', async () => {
    const worker = new FakeWorker();
    const handle = startEpgParse(REQUEST, { createWorker: () => worker as unknown as Worker });

    worker.emit({ type: 'error', error: { kind: 'cors', message: 'blocked' } });

    const error = await handle.promise.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EpgFetchError);
    expect((error as EpgFetchError).kind).toBe('cors');
  });

  it('cancels by terminating the worker and rejecting with aborted', async () => {
    const worker = new FakeWorker();
    const handle = startEpgParse(REQUEST, { createWorker: () => worker as unknown as Worker });

    handle.cancel();

    const error = await handle.promise.catch((e: unknown) => e);
    expect((error as EpgFetchError).kind).toBe('aborted');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('rejects when the worker stalls without any message', async () => {
    vi.useFakeTimers();
    try {
      const worker = new FakeWorker();
      const handle = startEpgParse(REQUEST, {
        createWorker: () => worker as unknown as Worker,
        watchdogMs: 100,
      });

      vi.advanceTimersByTime(100);
      const error = await handle.promise.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(EpgFetchError);
      expect((error as EpgFetchError).kind).toBe('timeout');
      expect(worker.terminate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('re-arms the watchdog while progress keeps arriving', async () => {
    vi.useFakeTimers();
    try {
      const worker = new FakeWorker();
      const handle = startEpgParse(REQUEST, {
        createWorker: () => worker as unknown as Worker,
        watchdogMs: 100,
      });

      vi.advanceTimersByTime(80);
      worker.emit({
        type: 'progress',
        progress: { bytes: 1, channels: 0, programmesKept: 0, programmesSkipped: 0 },
      });
      vi.advanceTimersByTime(80);

      let settled = false;
      void handle.promise.catch(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);

      vi.advanceTimersByTime(30);
      const error = await handle.promise.catch((e: unknown) => e);
      expect((error as EpgFetchError).kind).toBe('timeout');
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects when the worker itself errors', async () => {
    const worker = new FakeWorker();
    const handle = startEpgParse(REQUEST, { createWorker: () => worker as unknown as Worker });

    worker.fail('boom');

    const error = await handle.promise.catch((e: unknown) => e);
    expect((error as EpgFetchError).kind).toBe('unknown');
  });
});
