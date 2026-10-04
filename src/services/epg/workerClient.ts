/**
 * Typed `postMessage` RPC for the EPG parser worker. Hand-rolled instead of
 * Comlink so the lazy chunk stays tiny and there is no extra dependency.
 */

import { EpgFetchError } from './fetcher.ts';
import type { EpgParseProgress, EpgParseResult } from './parseXmltv.ts';
import type { EpgParseRequest, EpgWorkerMessage } from './workerProtocol.ts';

export interface EpgParseOutcome {
  result: EpgParseResult;
  notModified: boolean;
  etag?: string;
  lastModified?: string;
}

export interface StartEpgParseOptions {
  onProgress?: (progress: EpgParseProgress) => void;
  /** Injectable worker factory for tests. */
  createWorker?: () => Worker;
  /**
   * Reject if the worker sends nothing for this long (default 90 s). Re-armed on
   * every progress message, so a long steady download is never killed while a
   * stuck worker always surfaces a retryable error.
   */
  watchdogMs?: number;
}

export interface EpgParseHandle {
  promise: Promise<EpgParseOutcome>;
  cancel(): void;
}

export function startEpgParse(
  request: EpgParseRequest,
  options: StartEpgParseOptions = {}
): EpgParseHandle {
  const createWorker =
    options.createWorker ??
    (() => new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' }));
  const worker = createWorker();
  const watchdogMs = options.watchdogMs ?? 90_000;
  let settled = false;
  let rejectFn: (reason?: unknown) => void = () => {};
  let watchdog: ReturnType<typeof setTimeout> | null = null;

  const clearWatchdog = () => {
    if (watchdog) {
      clearTimeout(watchdog);
      watchdog = null;
    }
  };

  const settle = (finish: () => void) => {
    if (settled) return;
    settled = true;
    clearWatchdog();
    worker.terminate();
    finish();
  };

  const armWatchdog = () => {
    if (!watchdogMs) return;
    clearWatchdog();
    watchdog = setTimeout(() => {
      settle(() =>
        rejectFn(
          new EpgFetchError(
            'timeout',
            'The EPG refresh stalled while downloading. Check the URL and network, then retry.'
          )
        )
      );
    }, watchdogMs);
  };

  const promise = new Promise<EpgParseOutcome>((resolve, reject) => {
    rejectFn = reject;

    worker.onmessage = (event: MessageEvent<EpgWorkerMessage>) => {
      const message = event.data;
      if (message.type === 'progress') {
        armWatchdog();
        options.onProgress?.(message.progress);
        return;
      }
      settle(() => {
        if (message.type === 'done') {
          resolve({
            result: message.result,
            notModified: message.notModified,
            etag: message.etag,
            lastModified: message.lastModified,
          });
        } else {
          reject(new EpgFetchError(message.error.kind, message.error.message));
        }
      });
    };

    worker.onerror = (event: ErrorEvent) => {
      settle(() => reject(new EpgFetchError('unknown', event.message || 'EPG worker failed.')));
    };
  });

  armWatchdog();

  return {
    promise,
    cancel() {
      settle(() => rejectFn(new EpgFetchError('aborted', 'EPG parse was cancelled.')));
    },
  };
}
