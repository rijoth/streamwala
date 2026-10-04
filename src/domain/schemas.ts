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
  epgPromptDismissed: z.boolean().optional(),
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

export const ProgramSchema = z.object({
  id: z.string().min(1),
  channelId: z.string().min(1),
  tvgId: z.string().optional(),
  sourceId: z.string().optional(),
  start: z.number(),
  stop: z.number(),
  title: z.string(),
  subTitle: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  icon: z.string().optional(),
  rating: z.string().optional(),
  episodeNumber: z.string().optional(),
  language: z.string().optional(),
});

export const EpgSourceSchema = z.object({
  id: z.string().min(1),
  playlistId: z.string().min(1),
  name: z.string(),
  url: z.string().url().optional().or(z.literal('')),
  kind: z.enum(['remote', 'file', 'xtream']),
  enabled: z.boolean(),
  priority: z.number(),
  etag: z.string().optional(),
  lastModified: z.string().optional(),
  lastFetchedAt: z.number().optional(),
  lastUpdatedAt: z.number().optional(),
  channelCount: z.number(),
  programmeCount: z.number(),
  matchRate: z.number().min(0).max(1).optional(),
  ttlHours: z.number().positive().optional(),
});

export const EpgChannelSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  playlistId: z.string().min(1),
  xmltvId: z.string().min(1),
  displayNames: z.array(z.string()),
  icon: z.string().optional(),
});

export const EpgMappingSchema = z.object({
  channelId: z.string().min(1),
  playlistId: z.string().min(1),
  sourceId: z.string().optional(),
  epgChannelId: z.string().min(1),
  xmltvId: z.string().min(1),
  method: z.enum(['tvg-id', 'name', 'fuzzy', 'manual']),
  confidence: z.number().min(0).max(1),
  manual: z.boolean(),
  updatedAt: z.number(),
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
  epgTtlHours: z.number().positive(),
  epgRetentionPastDays: z.number().min(0),
  epgRetentionFutureDays: z.number().min(0),
  epgRemindersEnabled: z.boolean(),
});
