/**
 * Pure match-report view. Combines persisted mappings (manual wins) with a
 * fresh run of the matcher over the stored XMLTV channels, so the report is
 * always accurate without refetching.
 */

import type { Channel, EpgChannel, EpgMapping } from '../../domain/types.ts';
import {
  matchChannels,
  type EpgAmbiguousMatch,
  type EpgMatchMethod,
} from '../../domain/epg/matching.ts';

export interface EpgMatchedChannel {
  channelId: string;
  xmltvId: string;
  method: EpgMatchMethod;
  confidence: number;
}

export interface EpgMatchReportView {
  total: number;
  matched: EpgMatchedChannel[];
  unmatched: Channel[];
  ambiguous: EpgAmbiguousMatch[];
}

export function buildEpgMatchReport(
  channels: readonly Channel[],
  epgChannels: readonly EpgChannel[],
  mappings: readonly EpgMapping[]
): EpgMatchReportView {
  const persisted = new Map(mappings.map((m) => [m.channelId, m]));
  const candidates = epgChannels.map((c) => ({
    xmltvId: c.xmltvId,
    displayNames: c.displayNames,
  }));

  const auto = matchChannels(
    channels.map((c) => ({ id: c.id, name: c.name, tvgId: c.tvgId, tvgName: c.tvgName })),
    candidates
  );
  const autoByChannel = new Map(auto.matched.map((m) => [m.channelId, m]));
  const ambiguousByChannel = new Map(auto.ambiguous.map((a) => [a.channelId, a]));

  const matched: EpgMatchedChannel[] = [];
  const unmatched: Channel[] = [];
  const ambiguous: EpgAmbiguousMatch[] = [];

  for (const channel of channels) {
    const mapping = persisted.get(channel.id);
    if (mapping) {
      matched.push({
        channelId: channel.id,
        xmltvId: mapping.xmltvId,
        method: mapping.method,
        confidence: mapping.confidence,
      });
      continue;
    }
    const autoMatch = autoByChannel.get(channel.id);
    if (autoMatch) {
      matched.push({
        channelId: channel.id,
        xmltvId: autoMatch.xmltvId,
        method: autoMatch.method,
        confidence: autoMatch.confidence,
      });
      continue;
    }
    const ambiguousMatch = ambiguousByChannel.get(channel.id);
    if (ambiguousMatch) {
      ambiguous.push(ambiguousMatch);
      continue;
    }
    unmatched.push(channel);
  }

  return { total: channels.length, matched, unmatched, ambiguous };
}
