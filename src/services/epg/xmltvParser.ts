import { Program } from '../../domain/types.ts';
import { db } from '../storage/db.ts';

export function parseXmltvDate(dateStr: string): number {
  // Format: 20261004030000 +0000 or 20261004030000
  if (!dateStr || dateStr.length < 14) return Date.now();

  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1;
  const day = parseInt(dateStr.substring(6, 8), 10);
  const hour = parseInt(dateStr.substring(8, 10), 10);
  const min = parseInt(dateStr.substring(10, 12), 10);
  const sec = parseInt(dateStr.substring(12, 14), 10);

  // Parse timezone offset if present
  let offsetMinutes = 0;
  if (dateStr.length >= 19) {
    const tzSign = dateStr[15] === '-' ? -1 : 1;
    const tzHours = parseInt(dateStr.substring(16, 18), 10);
    const tzMins = parseInt(dateStr.substring(18, 20), 10);
    offsetMinutes = tzSign * (tzHours * 60 + tzMins);
  }

  // Construct UTC timestamp
  const utc = Date.UTC(year, month, day, hour, min, sec);
  return utc - offsetMinutes * 60 * 1000;
}

export async function parseAndSaveXmltv(
  xmlContent: string,
  playlistId: string,
  onProgress?: (count: number) => void
): Promise<number> {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

  // Map channels in DB by tvgId or name for quick lookup
  const channels = await db.channels.where({ playlistId }).toArray();
  const channelLookup = new Map<string, string>(); // tvgId/name -> channelId
  channels.forEach(ch => {
    if (ch.tvgId) channelLookup.set(ch.tvgId.toLowerCase(), ch.id);
    if (ch.tvgName) channelLookup.set(ch.tvgName.toLowerCase(), ch.id);
    channelLookup.set(ch.name.toLowerCase(), ch.id);
  });

  const programmeNodes = xmlDoc.getElementsByTagName('programme');
  const total = programmeNodes.length;
  const programs: Program[] = [];

  for (let i = 0; i < total; i++) {
    const node = programmeNodes[i];
    const channelAttr = node.getAttribute('channel');
    if (!channelAttr) continue;

    const matchedChannelId = channelLookup.get(channelAttr.toLowerCase());
    if (!matchedChannelId) continue;

    const startAttr = node.getAttribute('start') || '';
    const stopAttr = node.getAttribute('stop') || '';
    const start = parseXmltvDate(startAttr);
    const stop = parseXmltvDate(stopAttr);

    const titleEl = node.getElementsByTagName('title')[0];
    const descEl = node.getElementsByTagName('desc')[0];
    const catEl = node.getElementsByTagName('category')[0];
    const iconEl = node.getElementsByTagName('icon')[0];

    const title = titleEl ? titleEl.textContent || 'Untitled' : 'Untitled';
    const description = descEl ? descEl.textContent || undefined : undefined;
    const category = catEl ? catEl.textContent || undefined : undefined;
    const icon = iconEl ? iconEl.getAttribute('src') || undefined : undefined;

    programs.push({
      id: `prog_${matchedChannelId}_${start}`,
      channelId: matchedChannelId,
      tvgId: channelAttr,
      start,
      stop,
      title,
      description,
      category,
      icon,
    });

    if (programs.length % 500 === 0 && onProgress) {
      onProgress(programs.length);
    }
  }

  // Bulk save in batches
  const batchSize = 1000;
  for (let i = 0; i < programs.length; i += batchSize) {
    const chunk = programs.slice(i, i + batchSize);
    await db.programs.bulkPut(chunk);
  }

  return programs.length;
}
