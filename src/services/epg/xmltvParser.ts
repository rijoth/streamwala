import { Program } from '../../domain/types.ts';
import { db } from '../storage/db.ts';

export function parseXmltvDate(dateStr: string): number {
  // Format: YYYYMMDDHHMMSS with an optional numeric timezone: "+0530", "-0800",
  // "+05" or the same values attached without a separating space.
  if (!dateStr) return Date.now();

  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2})?)?/.exec(
    dateStr.trim()
  );
  if (!match) return Date.now();

  const [, year, month, day, hour, minute, second, sign, tzHours, tzMins] = match;
  const offsetMinutes = sign
    ? (sign === '-' ? -1 : 1) *
      (parseInt(tzHours, 10) * 60 + (tzMins ? parseInt(tzMins, 10) : 0))
    : 0;

  // Construct UTC timestamp
  const utc = Date.UTC(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
    parseInt(second, 10)
  );
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
    let stop = stopAttr ? parseXmltvDate(stopAttr) : NaN;
    // Programmes may omit `stop`; never let stop land before start.
    if (!Number.isFinite(stop) || stop <= start) {
      stop = start + 30 * 60 * 1000;
    }

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
