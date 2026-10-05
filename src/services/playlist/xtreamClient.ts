import { XtreamCredentials, Channel, Group, Playlist } from '../../domain/types.ts';
import { fetchWithTransportFallback } from '../net/transportFetch.ts';
import { db } from '../storage/db.ts';

/**
 * Xtream panel calls go through the transport plan (ADR 023): the panel is
 * queried directly first and only a real failure falls back to the configured
 * CORS proxy, so a dead proxy cannot stop a reachable panel from being added
 * (BUG-024).
 */
async function fetchXtreamJson<T>(
  url: string,
  proxyTemplate: string | undefined,
  timeoutMs?: number
): Promise<T> {
  const attempt = await fetchWithTransportFallback(url, { proxyTemplate, timeoutMs });
  if (!attempt.ok) {
    const detail = attempt.error instanceof Error ? attempt.error.message : String(attempt.error);
    throw new Error(
      attempt.usedProxy
        ? `The Xtream panel could not be reached, directly or through the CORS proxy in Settings (${detail}).`
        : `Network error or CORS restriction reaching the Xtream panel (${detail}).`
    );
  }
  if (!attempt.response.ok) {
    throw new Error(
      `Server returned HTTP ${attempt.response.status}: ${attempt.response.statusText}`
    );
  }
  return (await attempt.response.json()) as T;
}

export async function testXtreamLogin(creds: XtreamCredentials, proxyTemplate?: string): Promise<{ success: boolean; message: string; expDate?: string }> {
  try {
    let cleanServer = creds.serverUrl.trim().replace(/\/$/, '');
    if (!cleanServer.startsWith('http://') && !cleanServer.startsWith('https://')) {
      cleanServer = `http://${cleanServer}`;
    }

    const url = `${cleanServer}/player_api.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}`;

    const data = await fetchXtreamJson<{ user_info?: { auth?: number; status?: string; exp_date?: string } }>(
      url,
      proxyTemplate,
      8000
    );
    if (!data.user_info || data.user_info.auth === 0) {
      return { success: false, message: 'Invalid username or password.' };
    }

    return {
      success: true,
      message: `Connected successfully! Status: ${data.user_info.status || 'Active'}`,
      expDate: data.user_info.exp_date ? new Date(parseInt(data.user_info.exp_date, 10) * 1000).toLocaleDateString() : undefined,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
      return {
        success: false,
        message: 'Network error or CORS restriction. If your provider blocks browser requests, enable a CORS proxy template in Settings.',
      };
    }
    return { success: false, message: errorMsg };
  }
}

export async function importXtreamPlaylist(
  creds: XtreamCredentials,
  name: string,
  proxyTemplate?: string,
  onProgress?: (msg: string) => void
): Promise<Playlist> {
  let cleanServer = creds.serverUrl.trim().replace(/\/$/, '');
  if (!cleanServer.startsWith('http://') && !cleanServer.startsWith('https://')) {
    cleanServer = `http://${cleanServer}`;
  }

  const playlistId = `xtream_${Date.now()}`;
  onProgress?.('Fetching categories...');

  // 1. Fetch live categories
  const catUrl = `${cleanServer}/player_api.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}&action=get_live_categories`;

  const categories = await fetchXtreamJson<unknown>(catUrl, proxyTemplate);
  const groups: Group[] = Array.isArray(categories)
    ? categories.map((c: { category_id: string; category_name: string }) => ({
        id: `grp_${playlistId}_${c.category_id}`,
        playlistId,
        name: c.category_name,
        type: 'live',
        channelCount: 0,
      }))
    : [];

  const groupLookup = new Map(groups.map(g => [g.id.replace(`grp_${playlistId}_`, ''), g]));

  // 2. Fetch live streams
  onProgress?.('Fetching live channels...');
  const streamListUrl = `${cleanServer}/player_api.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}&action=get_live_streams`;

  const streamData = await fetchXtreamJson<unknown>(streamListUrl, proxyTemplate);

  const channels: Channel[] = [];
  if (Array.isArray(streamData)) {
    streamData.forEach((st: { stream_id: string; name: string; stream_icon?: string; category_id?: string; num?: number; epg_channel_id?: string }, idx: number) => {
      const catId = st.category_id || 'default';
      const grp = groupLookup.get(catId);
      const groupName = grp ? grp.name : 'General';
      const groupId = `grp_${playlistId}_${catId}`;

      if (grp) grp.channelCount++;

      // Form stream URL (M3U8 / TS)
      const streamUrl = `${cleanServer}/live/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${st.stream_id}.m3u8`;

      let numberVal = idx + 1;
      if (st.num !== undefined && st.num !== null) {
        const parsed = Number(st.num);
        if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
          numberVal = parsed;
        }
      }

      channels.push({
        id: `ch_${playlistId}_${st.stream_id}`,
        playlistId,
        name: st.name || `Channel ${idx + 1}`,
        logo: st.stream_icon,
        groupId,
        groupName,
        streamUrl,
        tvgId: st.epg_channel_id,
        number: numberVal,
        isFavorite: false,
        isHidden: false,
        isLocked: false,
      });
    });
  }

  onProgress?.('Saving to local database...');
  const playlist: Playlist = {
    id: playlistId,
    name: name || 'Xtream IPTV',
    type: 'xtream',
    xtream: creds,
    createdAt: Date.now(),
    lastSyncedAt: Date.now(),
    channelCount: channels.length,
    isActive: true,
  };

  await db.transaction('rw', [db.playlists, db.groups, db.channels], async () => {
    await db.playlists.toCollection().modify({ isActive: false });
    await db.playlists.put(playlist);
    await db.groups.bulkPut(groups);
    await db.channels.bulkPut(channels);
  });

  return playlist;
}
