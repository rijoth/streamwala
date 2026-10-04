/**
 * Pure domain entities and models for Aether IPTV.
 * Strictly NO React, NO I/O, NO external side effects.
 */

import type { EpgMatchMethod } from './epg/matching.ts';

export type PlaylistSourceType = 'm3u' | 'xtream' | 'file' | 'demo';

export interface XtreamCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface Playlist {
  id: string;
  name: string;
  type: PlaylistSourceType;
  url?: string;
  xtream?: XtreamCredentials;
  epgUrl?: string;
  createdAt: number;
  lastSyncedAt: number;
  channelCount: number;
  isActive: boolean;
}

export interface Channel {
  id: string;
  playlistId: string;
  name: string;
  logo?: string;
  groupId: string;
  groupName: string;
  streamUrl: string;
  tvgId?: string;
  tvgName?: string;
  number?: number;
  catchup?: string;
  isRadio?: boolean;
  isLocked?: boolean;
  isHidden?: boolean;
  isFavorite?: boolean;
}

export interface Group {
  id: string;
  playlistId: string;
  name: string;
  type: 'live' | 'vod' | 'series';
  channelCount: number;
}

export interface Program {
  id: string;
  channelId: string;
  tvgId?: string;
  /** EPG source that produced this programme (indexed for source cascade). */
  sourceId?: string;
  start: number; // Unix timestamp in ms
  stop: number;  // Unix timestamp in ms
  title: string;
  subTitle?: string;
  description?: string;
  category?: string;
  icon?: string;
  rating?: string;
  episodeNumber?: string;
  language?: string;
}

export type EpgSourceKind = 'remote' | 'file' | 'xtream';

/**
 * One XMLTV feed attached to a playlist. A playlist may hold several sources;
 * they are merged in `priority` order (lower wins) when resolving a channel.
 * Remote Xtream URLs embed credentials, so they are never logged or rendered
 * unmasked.
 */
export interface EpgSource {
  id: string;
  playlistId: string;
  name: string;
  url?: string;
  kind: EpgSourceKind;
  enabled: boolean;
  priority: number;
  /** Conditional-refresh validators, when the server exposes them via CORS. */
  etag?: string;
  lastModified?: string;
  lastFetchedAt?: number;
  /** Timestamp of the last successful parse (guide "updated N h ago"). */
  lastUpdatedAt?: number;
  channelCount: number;
  programmeCount: number;
  /** Fraction of the playlist's channels this source matched (0..1). */
  matchRate?: number;
  /** Per-source TTL override for the default 12 h refresh window. */
  ttlHours?: number;
}

/** A channel advertised by an XMLTV feed. */
export interface EpgChannel {
  /** Stable id: `${sourceId}::${xmltvId}` so it survives a source refresh. */
  id: string;
  sourceId: string;
  playlistId: string;
  xmltvId: string;
  displayNames: string[];
  icon?: string;
}

/**
 * Resolved channel → XMLTV channel mapping. Keyed by `channelId` so one
 * playlist channel maps to exactly one EPG channel. `manual` mappings always
 * override auto-matching and survive re-sync and EPG refresh.
 */
export interface EpgMapping {
  channelId: string;
  playlistId: string;
  sourceId?: string;
  epgChannelId: string;
  xmltvId: string;
  method: EpgMatchMethod;
  confidence: number;
  manual: boolean;
  updatedAt: number;
}

export interface VodItem {
  id: string;
  playlistId: string;
  name: string;
  streamUrl: string;
  posterUrl?: string;
  rating?: string;
  year?: string;
  plot?: string;
  duration?: number;
  progress?: number;
  categoryId?: string;
  categoryName?: string;
}

export interface HistoryEntry {
  id: string;
  channelId: string;
  name: string;
  logo?: string;
  streamUrl: string;
  watchedAt: number;
  duration?: number;
  position?: number;
}

export interface AppSettings {
  theme: 'dark' | 'amoled' | 'light';
  uiScale: number; // 0.8 to 1.5
  safePadding: boolean;
  defaultEngine: 'auto' | 'hls' | 'mpegts' | 'native';
  proxyUrlTemplate: string; // e.g. https://cors-anywhere.../
  parentalPin: string; // 4-digit PIN
  parentalLockedGroups: string[];
  defaultAspectRatio: 'fit' | 'fill' | '16:9' | '4:3' | 'zoom';
  bufferLengthSeconds: number;
  lowPowerMode: boolean;
  showNerdStats: boolean;
  /** Show the remote color-key legend in the content footer. */
  showRemoteHints: boolean;
}

export interface ProxyPreset {
  id: string;
  name: string;
  description: string;
  template: string;
}

export const PROXY_PRESETS: ProxyPreset[] = [
  {
    id: 'none',
    name: 'Direct (No Proxy)',
    description: 'Connect directly to the streaming server without any proxy',
    template: '',
  },
  {
    id: 'corsproxy_io',
    name: 'CORSProxy.io (Fastest)',
    description: 'High-speed public CORS proxy with streaming support',
    template: 'https://corsproxy.io/?url={url}',
  },
  {
    id: 'allorigins',
    name: 'AllOrigins CDN',
    description: 'Reliable Cloudflare-backed cross-origin proxy',
    template: 'https://api.allorigins.win/raw?url={url}',
  },
  {
    id: 'codetabs',
    name: 'CodeTabs Proxy',
    description: 'Lightweight proxy supporting GET and HEAD requests',
    template: 'https://api.codetabs.com/v1/proxy?quest={url}',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  uiScale: 1.0,
  safePadding: true,
  defaultEngine: 'auto',
  proxyUrlTemplate: '',
  parentalPin: '0000',
  parentalLockedGroups: [],
  defaultAspectRatio: 'fit',
  bufferLengthSeconds: 15,
  lowPowerMode: false,
  showNerdStats: false,
  showRemoteHints: true,
};

