import { Playlist, Channel, Group, Program } from '../../domain/types.ts';
import { db, type AetherDatabase } from '../storage/db.ts';

export const DEMO_PLAYLIST_ID = 'demo_playlist_standard';

export const VERIFIED_DEMO_CHANNELS: Channel[] = [
  {
    id: 'ch_nasa_tv',
    playlistId: DEMO_PLAYLIST_ID,
    name: 'NASA TV HD (Public Live)',
    groupId: 'grp_news_science',
    groupName: 'Science & Documentary',
    streamUrl: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg',
    number: 1,
    tvgId: 'NASA.tv',
    tvgName: 'NASA TV',
    isFavorite: true,
    isHidden: false,
    isLocked: false,
  },
  {
    id: 'ch_big_buck_bunny',
    playlistId: DEMO_PLAYLIST_ID,
    name: 'Big Buck Bunny (Blender HLS)',
    groupId: 'grp_cinema_animation',
    groupName: 'Cinema & Open Movies',
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_buck_bunny_poster_big.jpg',
    number: 2,
    tvgId: 'BBB.tv',
    tvgName: 'Big Buck Bunny',
    isFavorite: true,
    isHidden: false,
    isLocked: false,
  },
  {
    id: 'ch_dw_news',
    playlistId: DEMO_PLAYLIST_ID,
    name: 'Deutsche Welle (DW Live News HD)',
    groupId: 'grp_news_science',
    groupName: 'Science & Documentary',
    streamUrl: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Deutsche_Welle_symbol_2012.svg',
    number: 3,
    tvgId: 'DW.tv',
    tvgName: 'DW News',
    isFavorite: true,
    isHidden: false,
    isLocked: false,
  },
  {
    id: 'ch_tears_of_steel',
    playlistId: DEMO_PLAYLIST_ID,
    name: 'Tears of Steel (Sci-Fi VFX)',
    groupId: 'grp_cinema_animation',
    groupName: 'Cinema & Open Movies',
    streamUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/0/07/Tears_of_Steel_poster.jpg',
    number: 4,
    tvgId: 'TOS.tv',
    tvgName: 'Tears of Steel',
    isFavorite: false,
    isHidden: false,
    isLocked: false,
  },
  {
    id: 'ch_akamai_test',
    playlistId: DEMO_PLAYLIST_ID,
    name: 'Akamai Ultra HD Test Feed',
    groupId: 'grp_news_science',
    groupName: 'Science & Documentary',
    streamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Akamai_logo.svg',
    number: 5,
    tvgId: 'Akamai.tv',
    tvgName: 'Akamai HD',
    isFavorite: false,
    isHidden: false,
    isLocked: false,
  },
  {
    id: 'ch_apple_bipbop',
    playlistId: DEMO_PLAYLIST_ID,
    name: 'Apple BipBop (Multi-Track HLS)',
    groupId: 'grp_sports_action',
    groupName: 'Sports & Outdoors',
    streamUrl: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
    number: 6,
    tvgId: 'BipBop.tv',
    tvgName: 'Apple BipBop',
    isFavorite: true,
    isHidden: false,
    isLocked: false,
  },
  {
    id: 'ch_mux_test',
    playlistId: DEMO_PLAYLIST_ID,
    name: 'Mux Adaptive Stream Test',
    groupId: 'grp_cinema_animation',
    groupName: 'Cinema & Open Movies',
    streamUrl: 'https://test-streams.mux.dev/test_001/stream.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg',
    number: 7,
    tvgId: 'MuxTest.tv',
    tvgName: 'Mux Test',
    isFavorite: false,
    isHidden: false,
    isLocked: false,
  },
  {
    id: 'ch_action_sports',
    playlistId: DEMO_PLAYLIST_ID,
    name: 'Action Velocity Live',
    groupId: 'grp_sports_action',
    groupName: 'Sports & Outdoors',
    streamUrl: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Olympic_Rings.svg',
    number: 8,
    tvgId: 'Sports.tv',
    tvgName: 'Sports Action',
    isFavorite: false,
    isHidden: false,
    isLocked: false,
  },
];

export async function installDemoPlaylist(database: AetherDatabase = db): Promise<Playlist> {
  const playlist: Playlist = {
    id: DEMO_PLAYLIST_ID,
    name: 'Aether Public Demo (Legal Streams)',
    type: 'demo',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    createdAt: Date.now(),
    lastSyncedAt: Date.now(),
    channelCount: VERIFIED_DEMO_CHANNELS.length,
    isActive: true,
  };

  const groups: Group[] = [
    { id: 'grp_news_science', playlistId: DEMO_PLAYLIST_ID, name: 'Science & Documentary', type: 'live', channelCount: 3 },
    { id: 'grp_cinema_animation', playlistId: DEMO_PLAYLIST_ID, name: 'Cinema & Open Movies', type: 'live', channelCount: 3 },
    { id: 'grp_sports_action', playlistId: DEMO_PLAYLIST_ID, name: 'Sports & Outdoors', type: 'live', channelCount: 2 },
  ];

  // Generate realistic EPG programs centered around current time
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  const programs: Program[] = [];

  const sampleTitles = [
    { title: 'Live ISS Earth Views & Science Brief', desc: 'Real-time high definition video views of Earth from the International Space Station exterior cameras.' },
    { title: 'DW Global 3000: World in Focus', desc: 'International journalism, cultural perspectives, and daily geopolitical updates.' },
    { title: 'Open Source Cinema Showcase', desc: 'A curated showcase of open-source animation and cinematography.' },
    { title: 'Extreme Sports World Tour Showcase', desc: 'Highlights and expert multi-track audio commentary from international competitions.' },
    { title: 'Tears of Steel Sci-Fi Feature', desc: 'Post-apocalyptic narrative starring an elite robotics engineer with surround audio.' },
    { title: 'Earth Science Today: Climate & Oceans', desc: 'Daily meteorological analysis and oceanic current modeling.' },
  ];

  VERIFIED_DEMO_CHANNELS.forEach((channel, cIdx) => {
    // Generate 8 consecutive 1-hour program blocks from -2 hours to +6 hours
    for (let slot = -2; slot < 6; slot++) {
      const start = Math.floor(now / ONE_HOUR) * ONE_HOUR + slot * ONE_HOUR;
      const stop = start + ONE_HOUR;
      const titleObj = sampleTitles[(cIdx + slot + 10) % sampleTitles.length];

      programs.push({
        id: `epg_${channel.id}_${slot}`,
        channelId: channel.id,
        tvgId: channel.tvgId,
        start,
        stop,
        title: titleObj.title,
        description: titleObj.desc,
        category: channel.groupName,
        rating: 'TV-PG',
      });
    }
  });

  // Store in database
  await database.transaction('rw', [database.playlists, database.groups, database.channels, database.programs], async () => {
    // Preserve the user's per-channel state (favorite/hidden/locked) across a
    // re-sync instead of resetting it to the shipped demo defaults.
    const existing = await database.channels.where({ playlistId: DEMO_PLAYLIST_ID }).toArray();
    const overrides = new Map(
      existing.map((c) => [c.id, { isFavorite: c.isFavorite, isHidden: c.isHidden, isLocked: c.isLocked }])
    );
    const mergedChannels = VERIFIED_DEMO_CHANNELS.map((c) => {
      const override = overrides.get(c.id);
      return override ? { ...c, ...override } : c;
    });

    await database.playlists.toCollection().modify({ isActive: false });
    await database.playlists.put(playlist);
    await database.groups.where({ playlistId: DEMO_PLAYLIST_ID }).delete();
    await database.groups.bulkPut(groups);
    await database.channels.where({ playlistId: DEMO_PLAYLIST_ID }).delete();
    await database.channels.bulkPut(mergedChannels);
    await database.programs.where({ channelId: 'ch_sintel_animation' }).delete();
    await database.programs.where({ channelId: 'ch_red_bull_action' }).delete();
    await database.programs.bulkPut(programs);
  });

  return playlist;
}

/**
 * Automatically migrate outdated demo channels (e.g. broken 403 Akamai URLs)
 * stored in the user's IndexedDB to the verified 100% working streams.
 */
export async function syncDemoPlaylistIfOutdated(database: AetherDatabase = db): Promise<boolean> {
  try {
    const demo = await database.playlists.get(DEMO_PLAYLIST_ID);
    if (!demo) return false;

    const channels = await database.channels.where({ playlistId: DEMO_PLAYLIST_ID }).toArray();
    const hasOutdatedUrls = channels.some(
      c => c.streamUrl.includes('bitdash-a.akamaihd.net') || c.id === 'ch_sintel_animation'
    );

    if (hasOutdatedUrls || channels.length < VERIFIED_DEMO_CHANNELS.length) {
      console.info('Outdated demo channels detected in IndexedDB. Refreshing to verified streams...');
      await installDemoPlaylist(database);
      return true;
    }
  } catch (err) {
    console.warn('Failed to check/update demo playlist:', err);
  }
  return false;
}
