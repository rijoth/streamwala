import type { EpgFetchErrorKind } from './fetcher.ts';
import type {
  EpgParseProgress,
  EpgParseResult,
  EpgParserChannel,
  EpgRetentionWindow,
} from './parseXmltv.ts';

/** Request sent to the parser worker (URL download or pre-read text). */
export interface EpgParseRequest {
  kind: 'url' | 'text';
  sourceId: string;
  url?: string;
  text?: string;
  proxyTemplate?: string;
  etag?: string;
  lastModified?: string;
  timeoutMs?: number;
  channels: EpgParserChannel[];
  now: number;
  retention?: EpgRetentionWindow;
}

export type EpgWorkerMessage =
  | { type: 'progress'; progress: EpgParseProgress }
  | {
      type: 'done';
      result: EpgParseResult;
      notModified: boolean;
      etag?: string;
      lastModified?: string;
    }
  | { type: 'error'; error: { kind: EpgFetchErrorKind; message: string } };
