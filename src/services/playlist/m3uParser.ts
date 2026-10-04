import { Channel, Group } from '../../domain/types.ts';
import { db, type StreamwalaDatabase } from '../storage/db.ts';

export interface ParseProgress {
  channelsFound: number;
  groupsFound: number;
  percentage?: number;
  status: string;
}

export interface ParseM3UOptions {
  playlistId: string;
  onProgress?: (progress: ParseProgress) => void;
  batchSize?: number;
  database?: StreamwalaDatabase;
}

export async function parseAndSaveM3U(
  content: string,
  options: ParseM3UOptions
): Promise<{ channelCount: number; groupCount: number }> {
  const { playlistId, onProgress, batchSize = 1000, database = db } = options;

  const lines = content.split(/\r?\n/);
  const totalLines = lines.length;

  const channels: Channel[] = [];
  const groupsMap = new Map<string, Group>();

  let currentExtInf: string | null = null;
  let lineCount = 0;

  for (let i = 0; i < totalLines; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    lineCount++;

    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      currentExtInf = line;
      continue;
    }

    // Ignore other directives except stream url
    if (line.startsWith('#')) {
      continue;
    }

    // This is a stream URL associated with previous EXTINF or standalone
    if (currentExtInf || line.startsWith('http://') || line.startsWith('https://')) {
      const streamUrl = line;
      const parsedChannel = parseExtInfLine(currentExtInf || '', streamUrl, playlistId, channels.length + 1);
      
      channels.push(parsedChannel);

      // Track group
      if (!groupsMap.has(parsedChannel.groupId)) {
        groupsMap.set(parsedChannel.groupId, {
          id: parsedChannel.groupId,
          playlistId,
          name: parsedChannel.groupName,
          type: 'live',
          channelCount: 1,
        });
      } else {
        const grp = groupsMap.get(parsedChannel.groupId)!;
        grp.channelCount++;
      }

      currentExtInf = null;

      // Report progress periodically
      if (channels.length % 250 === 0 && onProgress) {
        const percent = totalLines > 0 ? Math.min(95, Math.round((lineCount / totalLines) * 90)) : 50;
        onProgress({
          channelsFound: channels.length,
          groupsFound: groupsMap.size,
          percentage: !Number.isNaN(percent) ? percent : 50,
          status: `Found ${channels.length} channels...`,
        });
      }
    }
  }

  // Persist into Dexie in batches to avoid blocking
  if (onProgress) {
    onProgress({
      channelsFound: channels.length,
      groupsFound: groupsMap.size,
      percentage: 95,
      status: 'Saving to local database...',
    });
  }

  // Persist groups and channels in one transaction so a mid-import failure
  // cannot leave partial/corrupt rows behind.
  await database.transaction('rw', [database.groups, database.channels], async () => {
    await database.groups.bulkPut(Array.from(groupsMap.values()));

    for (let j = 0; j < channels.length; j += batchSize) {
      const chunk = channels.slice(j, j + batchSize);
      await database.channels.bulkPut(chunk);
    }
  });

  if (onProgress) {
    onProgress({
      channelsFound: channels.length,
      groupsFound: groupsMap.size,
      percentage: 100,
      status: 'Import complete!',
    });
  }

  return {
    channelCount: channels.length,
    groupCount: groupsMap.size,
  };
}

export interface M3uHeaderInfo {
  epgUrls: string[];
}

/**
 * Reads the playlist header (`#EXTM3U url-tvg="..." x-tvg-url="..."`). The
 * URLs are suggestions only: the UI must ask before fetching an unknown host.
 */
export function parseM3uHeader(content: string): M3uHeaderInfo {
  const firstLineEnd = content.indexOf('\n');
  const headerLine = firstLineEnd === -1 ? content : content.slice(0, firstLineEnd);
  const epgUrls: string[] = [];
  const attrRe = /(?:url-tvg|x-tvg-url|url-tvg-url)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/gi;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(headerLine)) !== null) {
    const value = match[1] ?? match[2] ?? match[3] ?? '';
    for (const part of value.split(',')) {
      const url = part.trim();
      if (url) epgUrls.push(url);
    }
  }
  return { epgUrls };
}

function parseExtInfLine(extInf: string, streamUrl: string, playlistId: string, index: number): Channel {
  // Extract attributes: tvg-id, tvg-name, tvg-logo, group-title, tvg-chno
  const tvgId = extractAttribute(extInf, 'tvg-id');
  const tvgName = extractAttribute(extInf, 'tvg-name');
  const tvgLogo = extractAttribute(extInf, 'tvg-logo');
  const groupTitle = extractAttribute(extInf, 'group-title') || 'General';
  const tvgChno = extractAttribute(extInf, 'tvg-chno');
  const tvgShift = extractAttribute(extInf, 'tvg-shift');

  // Channel title is after the last comma in EXTINF line
  let name = `Channel ${index}`;
  const commaIndex = extInf.lastIndexOf(',');
  if (commaIndex !== -1 && commaIndex < extInf.length - 1) {
    name = extInf.substring(commaIndex + 1).trim();
  } else if (tvgName) {
    name = tvgName;
  }

  const groupId = `grp_${playlistId}_${slugify(groupTitle)}`;
  const channelId = `ch_${playlistId}_${index}_${slugify(name).slice(0, 20)}`;

  let numberVal: number = index;
  if (tvgChno) {
    const parsed = parseInt(tvgChno, 10);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      numberVal = parsed;
    }
  }

  let shiftVal: number | undefined;
  if (tvgShift) {
    const parsed = Number.parseFloat(tvgShift);
    if (Number.isFinite(parsed) && parsed !== 0) shiftVal = parsed;
  }

  return {
    id: channelId,
    playlistId,
    name,
    logo: tvgLogo || undefined,
    groupId,
    groupName: groupTitle,
    streamUrl,
    tvgId: tvgId || undefined,
    tvgName: tvgName || undefined,
    tvgShift: shiftVal,
    number: numberVal,
    isFavorite: false,
    isHidden: false,
    isLocked: false,
  };
}

function extractAttribute(line: string, attr: string): string | null {
  const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
  const match = line.match(regex);
  if (match && match[1]) {
    return match[1];
  }

  // Also check without quotes: attr=value
  const regexNoQuotes = new RegExp(`${attr}=([^\\s,]+)`, 'i');
  const matchNoQuotes = line.match(regexNoQuotes);
  if (matchNoQuotes && matchNoQuotes[1]) {
    return matchNoQuotes[1];
  }

  return null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '_')
    .slice(0, 30);
}
