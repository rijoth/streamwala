/**
 * Pure domain entities and models for Aether IPTV.
 * Strictly NO React, NO I/O, NO external side effects.
 */

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
  start: number; // Unix timestamp in ms
  stop: number;  // Unix timestamp in ms
  title: string;
  description?: string;
  category?: string;
  icon?: string;
  rating?: string;
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

