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
  let settled = false;
  let rejectFn: (reason?: unknown) => void = () => {};

  const promise = new Promise<EpgParseOutcome>((resolve, reject) => {
    rejectFn = reject;

    worker.onmessage = (event: MessageEvent<EpgWorkerMessage>) => {
      const message = event.data;
      if (message.type === 'progress') {
        options.onProgress?.(message.progress);
        return;
      }
      if (settled) return;
      settled = true;
      worker.terminate();
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
    };

    worker.onerror = (event: ErrorEvent) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      reject(new EpgFetchError('unknown', event.message || 'EPG worker failed.'));
    };
  });

  return {
    promise,
    cancel() {
      if (settled) return;
      settled = true;
      worker.terminate();
      rejectFn(new EpgFetchError('aborted', 'EPG parse was cancelled.'));
    },
  };
}
