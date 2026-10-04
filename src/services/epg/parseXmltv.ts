/**
 * Pure XMLTV parsing pipeline: tokenize → match channels → filter to the
 * retention window → per-channel programme lists. No React, no storage, no
 * fetch; the worker streams decoded chunks into {@link createXmltvParser} and
 * the repository performs the atomic swap afterwards.
 */

import type { Program, ProgrammeImport } from '../../domain/types.ts';
import {
  matchChannels,
  type EpgMatchChannelInput,
  type EpgMatchOptions,
  type EpgMatchReport,
} from '../../domain/epg/matching.ts';
import {
  DEFAULT_PROGRAMME_DURATION_MS,
  applyTvgShift,
  parseXmltvDate,
} from '../../domain/epg/time.ts';
import { createXmltvTokenizer, type XmltvRawChannel, type XmltvRawProgramme } from './xmltvTokenizer.ts';

export interface EpgParserChannel extends EpgMatchChannelInput {
  tvgShift?: number;
}

export interface EpgRetentionWindow {
  /** Keep programmes that ended within this many ms before now. */
  pastMs?: number;
  /** Keep programmes that start within this many ms after now. */
  futureMs?: number;
}

export interface EpgParseStats {
  bytes: number;
  channels: number;
  programmesKept: number;
  programmesSkipped: number;
  badDates: number;
  errors: number;
}

export interface EpgParseProgress {
  bytes: number;
  totalBytes?: number;
  channels: number;
  programmesKept: number;
  programmesSkipped: number;
}

export interface EpgParseResult {
  channels: XmltvRawChannel[];
  matchReport: EpgMatchReport;
  imports: ProgrammeImport[];
  stats: EpgParseStats;
}

export interface EpgParserOptions {
  sourceId: string;
  channels: EpgParserChannel[];
  now: number;
  retention?: EpgRetentionWindow;
  defaultDurationMs?: number;
  matchOptions?: EpgMatchOptions;
  onProgress?: (progress: EpgParseProgress) => void;
  /** Emit a progress event every N kept programmes. */
  progressEvery?: number;
}

export interface XmltvParser {
  push(chunk: string, byteLength?: number): void;
  end(): EpgParseResult;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function createXmltvParser(options: EpgParserOptions): XmltvParser {
  const pastMs = options.retention?.pastMs ?? DAY_MS;
  const futureMs = options.retention?.futureMs ?? 3 * DAY_MS;
  const windowStart = options.now - pastMs;
  const windowEnd = options.now + futureMs;
  const defaultDurationMs = options.defaultDurationMs ?? DEFAULT_PROGRAMME_DURATION_MS;
  const progressEvery = options.progressEvery ?? 500;

  const channelById = new Map(options.channels.map((channel) => [channel.id, channel]));
  const candidates: XmltvRawChannel[] = [];
  const programmesByChannel = new Map<string, Program[]>();
  const matchedChannelByXmltvId = new Map<string, EpgParserChannel>();
  const lastByChannel = new Map<string, Program>();
  const stopKnownByChannel = new Map<string, boolean>();
  const seenIds = new Set<string>();

  const stats: EpgParseStats = {
    bytes: 0,
    channels: 0,
    programmesKept: 0,
    programmesSkipped: 0,
    badDates: 0,
    errors: 0,
  };
  let matchReport: EpgMatchReport = { matched: [], unmatched: [], ambiguous: [] };
  let matched = false;

  const reportProgress = () => {
    options.onProgress?.({
      bytes: stats.bytes,
      channels: stats.channels,
      programmesKept: stats.programmesKept,
      programmesSkipped: stats.programmesSkipped,
    });
  };

  const ensureMatched = () => {
    if (matched) return;
    matched = true;
    matchReport = matchChannels(
      options.channels,
      candidates.map((c) => ({ xmltvId: c.id, displayNames: c.displayNames })),
      options.matchOptions
    );
    for (const match of matchReport.matched) {
      const channel = channelById.get(match.channelId);
      if (channel) matchedChannelByXmltvId.set(match.xmltvId, channel);
    }
  };

  const handleChannel = (raw: XmltvRawChannel) => {
    candidates.push(raw);
    stats.channels = candidates.length;
  };

  const handleProgramme = (raw: XmltvRawProgramme) => {
    ensureMatched();
    const channel = matchedChannelByXmltvId.get(raw.channel);
    if (!channel) {
      stats.programmesSkipped++;
      return;
    }

    const rawStart = parseXmltvDate(raw.start);
    if (!Number.isFinite(rawStart)) {
      stats.badDates++;
      stats.programmesSkipped++;
      return;
    }
    const start = applyTvgShift(rawStart, channel.tvgShift);
    if (start > windowEnd) {
      stats.programmesSkipped++;
      return;
    }

    const rawStop = raw.stop ? parseXmltvDate(raw.stop) : Number.NaN;
    let stop = applyTvgShift(rawStop, channel.tvgShift);
    if (Number.isFinite(stop) && stop < windowStart) {
      stats.programmesSkipped++;
      return;
    }
    const stopKnown = Number.isFinite(stop) && stop > start;
    if (!stopKnown) stop = start + defaultDurationMs;

    const id = `prog_${channel.id}_${start}`;
    if (seenIds.has(id)) {
      stats.programmesSkipped++;
      return;
    }
    const last = lastByChannel.get(channel.id);
    if (last && start <= last.start) {
      // Duplicate or out-of-order programme: keep the first, count the rest.
      stats.programmesSkipped++;
      return;
    }
    if (last) {
      // A programme with no `stop` ends when the next one starts; an overlap is
      // trimmed to the next start, never dropped.
      if (!stopKnownByChannel.get(channel.id) || last.stop > start) last.stop = start;
    }
    stopKnownByChannel.set(channel.id, stopKnown);

    const program: Program = {
      id,
      channelId: channel.id,
      tvgId: raw.channel,
      sourceId: options.sourceId,
      start,
      stop,
      title: raw.title || 'Untitled',
      subTitle: raw.subTitle,
      description: raw.description,
      category: raw.category,
      icon: raw.icon,
      rating: raw.rating,
      episodeNumber: raw.episodeNumber,
      language: raw.language,
    };

    seenIds.add(id);
    lastByChannel.set(channel.id, program);
    const list = programmesByChannel.get(channel.id);
    if (list) list.push(program);
    else programmesByChannel.set(channel.id, [program]);

    stats.programmesKept++;
    if (stats.programmesKept % progressEvery === 0) reportProgress();
  };

  const tokenizer = createXmltvTokenizer({
    onChannel: handleChannel,
    onProgramme: handleProgramme,
    onError: () => {
      // Counted from the tokenizer's own stats at end(); nothing to do here.
    },
  });

  return {
    push(chunk, byteLength) {
      stats.bytes += byteLength ?? chunk.length;
      tokenizer.push(chunk);
    },
    end() {
      tokenizer.end();
      ensureMatched();
      stats.channels = candidates.length;
      stats.errors = tokenizer.stats.errors;
      reportProgress();
      const imports: ProgrammeImport[] = [...programmesByChannel.entries()].map(
        ([channelId, programs]) => ({ channelId, programs })
      );
      return { channels: candidates, matchReport, imports, stats: { ...stats } };
    },
  };
}

export function parseXmltvText(text: string, options: EpgParserOptions): EpgParseResult {
  const parser = createXmltvParser(options);
  parser.push(text);
  return parser.end();
}
