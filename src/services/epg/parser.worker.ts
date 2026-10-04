/**
 * EPG parser worker. Owns the network stream and the tolerant XMLTV tokenizer
 * so the main thread never holds the raw document. Posts progress, then either
 * the parsed result or a structured error. The main thread terminates this
 * worker on cancel/unmount.
 */

import { EpgFetchError, fetchEpgStream } from './fetcher.ts';
import { createXmltvParser, type EpgParseProgress } from './parseXmltv.ts';
import type { EpgParseRequest, EpgWorkerMessage } from './workerProtocol.ts';

const ctx = self as unknown as Worker;

function post(message: EpgWorkerMessage): void {
  ctx.postMessage(message);
}

ctx.onmessage = async (event: MessageEvent<EpgParseRequest>) => {
  const request = event.data;
  try {
    let latest: EpgParseProgress = {
      bytes: 0,
      channels: 0,
      programmesKept: 0,
      programmesSkipped: 0,
    };
    let downloaded = 0;
    const report = () => {
      post({ type: 'progress', progress: { ...latest, bytes: Math.max(latest.bytes, downloaded) } });
    };

    const parser = createXmltvParser({
      sourceId: request.sourceId,
      channels: request.channels,
      now: request.now,
      retention: request.retention,
      onProgress: (progress) => {
        latest = progress;
        report();
      },
    });

    let notModified = false;
    let etag = request.etag;
    let lastModified = request.lastModified;

    if (request.kind === 'url') {
      const result = await fetchEpgStream({
        url: request.url ?? '',
        proxyTemplate: request.proxyTemplate,
        etag: request.etag,
        lastModified: request.lastModified,
        timeoutMs: request.timeoutMs,
        onProgress: (progress) => {
          downloaded = progress.bytesReceived;
          report();
        },
      });
      notModified = result.notModified;
      etag = result.etag ?? etag;
      lastModified = result.lastModified ?? lastModified;

      if (!notModified) {
        const reader = result.stream.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.push(decoder.decode(value, { stream: true }), value.byteLength);
        }
        parser.push(decoder.decode());
      }
    } else {
      parser.push(request.text ?? '');
    }

    post({ type: 'done', result: parser.end(), notModified, etag, lastModified });
  } catch (error) {
    const kind = error instanceof EpgFetchError ? error.kind : 'parse';
    post({
      type: 'error',
      error: { kind, message: error instanceof Error ? error.message : String(error) },
    });
  }
};
