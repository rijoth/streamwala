import { z } from 'zod';

export const PlaylistSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Playlist name is required'),
  type: z.enum(['m3u', 'xtream', 'file', 'demo']),
  url: z.string().url().optional().or(z.literal('')),
  xtream: z.object({
    serverUrl: z.string().url(),
    username: z.string(),
    password: z.string(),
  }).optional(),
  epgUrl: z.string().url().optional().or(z.literal('')),
  createdAt: z.number(),
  lastSyncedAt: z.number(),
  channelCount: z.number(),
  isActive: z.boolean(),
});

export const ChannelSchema = z.object({
  id: z.string(),
  playlistId: z.string(),
  name: z.string(),
  logo: z.string().optional(),
  groupId: z.string(),
  groupName: z.string(),
  streamUrl: z.string(),
  tvgId: z.string().optional(),
  tvgName: z.string().optional(),
  number: z.number().optional(),
  catchup: z.string().optional(),
  isRadio: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

export const SettingsSchema = z.object({
  theme: z.enum(['dark', 'amoled', 'light']),
  uiScale: z.number().min(0.8).max(1.5),
  safePadding: z.boolean(),
  defaultEngine: z.enum(['auto', 'hls', 'mpegts', 'native']),
  proxyUrlTemplate: z.string(),
  parentalPin: z.string().length(4),
  parentalLockedGroups: z.array(z.string()),
  defaultAspectRatio: z.enum(['fit', 'fill', '16:9', '4:3', 'zoom']),
  bufferLengthSeconds: z.number().min(1).max(60),
  lowPowerMode: z.boolean(),
  showNerdStats: z.boolean(),
});
