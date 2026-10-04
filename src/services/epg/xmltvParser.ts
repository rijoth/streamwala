import { Program } from '../../domain/types.ts';
import { parseXmltvDate } from '../../domain/epg/time.ts';
import { db } from '../storage/db.ts';

// The canonical parser now lives in the pure domain layer. Re-exported here for
// existing callers; `parseAndSaveXmltv` is replaced by the streaming worker
// parser in a follow-up commit.
export { parseXmltvDate } from '../../domain/epg/time.ts';

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
    // Bad dates are skipped (and counted by the streaming parser later).
    if (!Number.isFinite(start)) continue;
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
