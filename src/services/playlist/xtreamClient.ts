import { XtreamCredentials, Channel, Group, Playlist } from '../../domain/types.ts';
import { db } from '../storage/db.ts';

export async function testXtreamLogin(creds: XtreamCredentials, proxyTemplate?: string): Promise<{ success: boolean; message: string; expDate?: string }> {
  try {
    let cleanServer = creds.serverUrl.trim().replace(/\/$/, '');
    if (!cleanServer.startsWith('http://') && !cleanServer.startsWith('https://')) {
      cleanServer = `http://${cleanServer}`;
    }

    let url = `${cleanServer}/player_api.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}`;
    if (proxyTemplate) {
      url = proxyTemplate.replace('{url}', encodeURIComponent(url));
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return { success: false, message: `Server returned HTTP ${res.status}: ${res.statusText}` };
    }

    const data = await res.json();
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
  let catUrl = `${cleanServer}/player_api.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}&action=get_live_categories`;
  if (proxyTemplate) catUrl = proxyTemplate.replace('{url}', encodeURIComponent(catUrl));

  const catRes = await fetch(catUrl);
  const categories = await catRes.json();

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
  let streamListUrl = `${cleanServer}/player_api.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}&action=get_live_streams`;
  if (proxyTemplate) streamListUrl = proxyTemplate.replace('{url}', encodeURIComponent(streamListUrl));

  const streamRes = await fetch(streamListUrl);
  const streamData = await streamRes.json();

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
