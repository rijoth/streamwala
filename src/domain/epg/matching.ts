/**
 * Pure channel ↔ XMLTV matching. No React, no I/O.
 *
 * Matching priority (each tier only runs when the previous one found nothing):
 *   1. exact `tvg-id` = XMLTV channel id (trimmed, case-insensitive),
 *   2. normalized `tvg-name` / channel name vs. XMLTV `display-name` values,
 *   3. conservative fuzzy similarity, and only when one candidate clearly wins.
 *
 * A tie never auto-maps: it is reported as `ambiguous` so the manual-mapping UI
 * can resolve it. Quality tags (`(720p)`, `HD`, `FHD`, `4K`, …) are stripped
 * before comparison, so messy playlist names still match.
 */

export interface EpgMatchChannelInput {
  id: string;
  name: string;
  tvgId?: string;
  tvgName?: string;
}

export interface EpgChannelCandidate {
  xmltvId: string;
  displayNames: string[];
}

export type EpgAutoMatchMethod = 'tvg-id' | 'name' | 'fuzzy';

/** Stored mapping method; `manual` always overrides auto-matching. */
export type EpgMatchMethod = EpgAutoMatchMethod | 'manual';

export interface EpgMatch {
  channelId: string;
  xmltvId: string;
  method: EpgAutoMatchMethod;
  /** 0..1; 1 = exact id/name, lower = fuzzier. */
  confidence: number;
}

export interface EpgCandidateScore {
  xmltvId: string;
  method: EpgAutoMatchMethod;
  confidence: number;
}

export interface EpgAmbiguousMatch {
  channelId: string;
  candidates: EpgCandidateScore[];
}

export interface EpgMatchReport {
  matched: EpgMatch[];
  unmatched: string[];
  ambiguous: EpgAmbiguousMatch[];
}

export type EpgMatchResolution =
  | { kind: 'matched'; match: EpgMatch }
  | { kind: 'ambiguous'; candidates: EpgCandidateScore[] }
  | { kind: 'unmatched' };

export interface EpgMatchOptions {
  /** Minimum Dice similarity for a fuzzy match. Conservative by default. */
  fuzzyThreshold?: number;
  /** Required lead of the best fuzzy candidate over the runner-up. */
  fuzzyMargin?: number;
  /** Strip country/region affixes such as `US:` or `[UK]` when normalizing. */
  stripCountryAffixes?: boolean;
}

const QUALITY_WORD =
  '(?:hd|fhd|uhd|qhd|sd|4k|8k|hdr10\\+?|hdr|hevc|h265|h264|avc|mpeg2|2160p|1440p|1080p|900p|720p|576p|480p|360p)';
const BRACKETED_QUALITY_RE = new RegExp(`[[(]\\s*${QUALITY_WORD}\\s*[\\])]`, 'gi');
const QUALITY_WORD_RE = new RegExp(`\\b${QUALITY_WORD}\\b`, 'gi');
const COUNTRY_PREFIX_RE = /^\s*(?:[[(][A-Z]{2,3}[\])]\s*|[A-Z]{2,3}\s*[:\-|]\s*)/;
const COUNTRY_SUFFIX_RE = /\s*[[(][A-Z]{2,3}[\])]\s*$/;

export interface NormalizeOptions {
  stripCountryAffixes?: boolean;
}

/**
 * Normalizes a channel/display name for comparison: strips diacritics and
 * quality tags, optionally country affixes, then lowercases and reduces to
 * single-space-separated alphanumerics.
 */
export function normalizeChannelName(name: string, options: NormalizeOptions = {}): string {
  if (!name) return '';
  const stripCountryAffixes = options.stripCountryAffixes ?? true;
  let value = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

  if (stripCountryAffixes) {
    value = value.replace(COUNTRY_PREFIX_RE, ' ').replace(COUNTRY_SUFFIX_RE, ' ');
  }

  value = value
    .replace(BRACKETED_QUALITY_RE, ' ')
    .replace(QUALITY_WORD_RE, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');

  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Sørensen–Dice similarity over character bigrams (0..1). Tolerant of word
 * reordering and small typos without the cost of full edit distance.
 */
export function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const gram = a.slice(i, i + 2);
    bigrams.set(gram, (bigrams.get(gram) ?? 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const gram = b.slice(i, i + 2);
    const remaining = bigrams.get(gram) ?? 0;
    if (remaining > 0) {
      bigrams.set(gram, remaining - 1);
      intersection++;
    }
  }

  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

function channelNameKeys(
  channel: EpgMatchChannelInput,
  stripCountryAffixes: boolean
): Set<string> {
  const keys = new Set<string>();
  if (channel.tvgName) {
    const normalized = normalizeChannelName(channel.tvgName, { stripCountryAffixes });
    if (normalized) keys.add(normalized);
  }
  if (channel.name) {
    const normalized = normalizeChannelName(channel.name, { stripCountryAffixes });
    if (normalized) keys.add(normalized);
  }
  return keys;
}

/**
 * Resolves a single channel against all XMLTV candidates.
 */
export function matchChannelToEpg(
  channel: EpgMatchChannelInput,
  candidates: readonly EpgChannelCandidate[],
  options: EpgMatchOptions = {}
): EpgMatchResolution {
  const {
    fuzzyThreshold = 0.86,
    fuzzyMargin = 0.08,
    stripCountryAffixes = true,
  } = options;

  // Tier 1: exact tvg-id.
  const tvgId = channel.tvgId?.trim().toLowerCase();
  if (tvgId) {
    const exact = candidates.find((c) => c.xmltvId.trim().toLowerCase() === tvgId);
    if (exact) {
      return {
        kind: 'matched',
        match: { channelId: channel.id, xmltvId: exact.xmltvId, method: 'tvg-id', confidence: 1 },
      };
    }
  }

  const keys = channelNameKeys(channel, stripCountryAffixes);

  // Tier 2: normalized name equality.
  if (keys.size > 0) {
    const exactIds = new Set<string>();
    for (const candidate of candidates) {
      for (const displayName of candidate.displayNames) {
        const normalized = normalizeChannelName(displayName, { stripCountryAffixes });
        if (normalized && keys.has(normalized)) {
          exactIds.add(candidate.xmltvId);
          break;
        }
      }
    }
    if (exactIds.size === 1) {
      const [xmltvId] = exactIds;
      return {
        kind: 'matched',
        match: { channelId: channel.id, xmltvId, method: 'name', confidence: 0.95 },
      };
    }
    if (exactIds.size > 1) {
      return {
        kind: 'ambiguous',
        candidates: [...exactIds].map((xmltvId) => ({ xmltvId, method: 'name', confidence: 1 })),
      };
    }
  }

  // Tier 3: conservative fuzzy match with a required margin over the runner-up.
  if (keys.size === 0) return { kind: 'unmatched' };

  const scored: EpgCandidateScore[] = [];
  for (const candidate of candidates) {
    let best = 0;
    for (const displayName of candidate.displayNames) {
      const normalized = normalizeChannelName(displayName, { stripCountryAffixes });
      if (!normalized) continue;
      for (const key of keys) {
        best = Math.max(best, diceCoefficient(key, normalized));
      }
    }
    if (best >= fuzzyThreshold) {
      scored.push({ xmltvId: candidate.xmltvId, method: 'fuzzy', confidence: best });
    }
  }
  scored.sort((a, b) => b.confidence - a.confidence);

  if (scored.length === 0) return { kind: 'unmatched' };
  if (scored.length === 1 || scored[0].confidence - scored[1].confidence >= fuzzyMargin) {
    return {
      kind: 'matched',
      match: {
        channelId: channel.id,
        xmltvId: scored[0].xmltvId,
        method: 'fuzzy',
        confidence: scored[0].confidence,
      },
    };
  }
  return { kind: 'ambiguous', candidates: scored };
}

/** Matches many channels and classifies the result for the match report. */
export function matchChannels(
  channels: readonly EpgMatchChannelInput[],
  candidates: readonly EpgChannelCandidate[],
  options: EpgMatchOptions = {}
): EpgMatchReport {
  const matched: EpgMatch[] = [];
  const unmatched: string[] = [];
  const ambiguous: EpgAmbiguousMatch[] = [];

  for (const channel of channels) {
    const resolution = matchChannelToEpg(channel, candidates, options);
    if (resolution.kind === 'matched') matched.push(resolution.match);
    else if (resolution.kind === 'ambiguous') {
      ambiguous.push({ channelId: channel.id, candidates: resolution.candidates });
    } else unmatched.push(channel.id);
  }

  return { matched, unmatched, ambiguous };
}
