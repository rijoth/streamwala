import React, { useState } from 'react';
import { useSettingsStore } from '../../app/settingsStore.ts';
import { FocusZone, useFocusable } from '../../shared/focus/index.ts';
import { Button, Card, TextField } from '../../shared/ui/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import { Playlist, PROXY_PRESETS } from '../../domain/types.ts';
import { db, savePlaylist } from '../../services/storage/db.ts';
import { PlaylistEpgPanel, EpgFirstRunBanner } from './epg/index.ts';

export interface SettingsViewProps {
  playlists: Playlist[];
  onAddNewPlaylist: () => void;
  onRefreshData: () => void;
}

interface FocusableTileProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'> {
  onPress: () => void;
  focusKey?: string;
}

/**
 * Styled settings tile registered with the spatial-navigation engine.
 * Plain `<button>` elements are invisible to the D-pad: only components that
 * call `useFocusable` are navigation stops and only they receive
 * `onEnterPress` (BUG-020).
 */
const FocusableTile: React.FC<FocusableTileProps> = ({
  onPress,
  focusKey,
  className = '',
  children,
  ...props
}) => {
  const { ref, focused } = useFocusable({ focusKey, onEnterPress: onPress });

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={onPress}
      className={`
        tv-focus-target cursor-pointer outline-none transition-all
        ${focused ? 'tv-focused' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  playlists,
  onAddNewPlaylist,
  onRefreshData,
}) => {
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<'appearance' | 'playback' | 'playlists' | 'network' | 'about'>('appearance');
  const [proxyTemplate, setProxyTemplate] = useState(settings.proxyUrlTemplate);
  const [pinCode, setPinCode] = useState(settings.parentalPin);
  const [isSavedMessage, setIsSavedMessage] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);

  const handleSaveNetwork = () => {
    updateSettings({ proxyUrlTemplate: proxyTemplate, parentalPin: pinCode });
    setIsSavedMessage(true);
    setTimeout(() => setIsSavedMessage(false), 2500);
  };

  const handleClearAllData = async () => {
    if (window.confirm('Are you sure you want to clear all playlists, channels, and cached guide data?')) {
      await db.delete();
      resetSettings();
      window.location.reload();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 text-[var(--md-sys-color-on-surface)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settings & Configuration</h2>
          <p className="text-xs text-[var(--md-sys-color-outline)]">Configure 10-foot TV display, playback engines, and network proxies.</p>
        </div>
        {isSavedMessage && (
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1.5 rounded-full flex items-center gap-1.5 animate-fade-in">
            <Icon name="check" size={16} />
            Settings Saved
          </span>
        )}
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-2 pb-4 border-b border-[var(--md-sys-color-outline-variant)]">
        <FocusZone focusKey="SETTINGS_TABS" ownsChildren className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          {[
            { id: 'appearance', label: 'Appearance & TV Safe Area', icon: 'palette' },
            { id: 'playback', label: 'Playback & Engines', icon: 'play_circle' },
            { id: 'playlists', label: 'Manage Playlists', icon: 'featured_play_list' },
            { id: 'network', label: 'Network & CORS Proxy', icon: 'lan' },
            { id: 'about', label: 'About & Legal Disclaimer', icon: 'info' },
          ].map((tab) => (
            <FocusableTile
              key={tab.id}
              focusKey={`SETTINGS_TAB_${tab.id}`}
              onPress={() => setActiveTab(tab.id as typeof activeTab)}
              className={`
                px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-2
                ${activeTab === tab.id
                  ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-md'
                  : 'bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]'
                }
              `}
            >
              <Icon name={tab.icon} size={16} />
              <span>{tab.label}</span>
            </FocusableTile>
          ))}
        </FocusZone>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto py-6 max-w-3xl">
        {/* APPEARANCE */}
        {activeTab === 'appearance' && (
          <FocusZone className="flex flex-col gap-6">
            <Card variant="filled" isInteractive={false} className="p-6 flex flex-col gap-4">
              <FocusZone focusKey="SETTINGS_SECTION_THEME" ownsChildren className="flex flex-col gap-4">
              <h3 className="font-bold text-lg">Display Theme</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'dark', label: 'Dark Mode (Default)', icon: 'dark_mode' },
                  { id: 'amoled', label: 'AMOLED Pure Black', icon: 'contrast' },
                  { id: 'light', label: 'Light Mode', icon: 'light_mode' },
                ].map((th) => (
                  <Button
                    key={th.id}
                    variant={settings.theme === th.id ? 'filled' : 'tonal'}
                    icon={th.icon}
                    onClick={() => updateSettings({ theme: th.id as 'dark' | 'amoled' | 'light' })}
                    className="!py-3 text-xs"
                  >
                    {th.label}
                  </Button>
                ))}
              </div>
              </FocusZone>
            </Card>

            <Card variant="filled" isInteractive={false} className="p-6 flex flex-col gap-4">
              <FocusZone focusKey="SETTINGS_SECTION_SAFE_AREA" ownsChildren className="flex flex-col gap-4">
              <h3 className="font-bold text-lg">TV Overscan Safe Area</h3>
              <p className="text-xs text-[var(--md-sys-color-outline)]">
                Adds 48px horizontal & 32px vertical margins to prevent UI clipping on older Smart TV screens.
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant={settings.safePadding ? 'filled' : 'tonal'}
                  icon={settings.safePadding ? 'check_box' : 'check_box_outline_blank'}
                  onClick={() => updateSettings({ safePadding: !settings.safePadding })}
                >
                  {settings.safePadding ? 'Safe Padding Enabled' : 'Safe Padding Disabled'}
                </Button>
              </div>
              </FocusZone>
            </Card>

            <Card variant="filled" isInteractive={false} className="p-6 flex flex-col gap-4">
              <FocusZone focusKey="SETTINGS_SECTION_HINTS" ownsChildren className="flex flex-col gap-4">
              <h3 className="font-bold text-lg">Remote Hint Bar</h3>
              <p className="text-xs text-[var(--md-sys-color-outline)]">
                Shows the color-key legend (Favs / Guide / Search / Settings) in the content footer on browse screens.
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant={settings.showRemoteHints ? 'filled' : 'tonal'}
                  icon={settings.showRemoteHints ? 'check_box' : 'check_box_outline_blank'}
                  onClick={() => updateSettings({ showRemoteHints: !settings.showRemoteHints })}
                >
                  {settings.showRemoteHints ? 'Remote Hints Shown' : 'Remote Hints Hidden'}
                </Button>
              </div>
              </FocusZone>
            </Card>

            <Card variant="filled" isInteractive={false} className="p-6 flex flex-col gap-4">
              <FocusZone focusKey="SETTINGS_SECTION_SCALE" ownsChildren className="flex flex-col gap-4">
              <h3 className="font-bold text-lg">TV UI Scale Factor</h3>
              <div className="flex items-center gap-4">
                {[0.9, 1.0, 1.1, 1.25].map((scale) => (
                  <Button
                    key={scale}
                    variant={settings.uiScale === scale ? 'filled' : 'tonal'}
                    onClick={() => updateSettings({ uiScale: scale })}
                    className="!px-4 !py-2 text-xs"
                  >
                    {Math.round(scale * 100)}%
                  </Button>
                ))}
              </div>
              </FocusZone>
            </Card>
          </FocusZone>
        )}

        {/* PLAYBACK */}
        {activeTab === 'playback' && (
          <FocusZone className="flex flex-col gap-6">
            <Card variant="filled" isInteractive={false} className="p-6 flex flex-col gap-4">
              <FocusZone focusKey="SETTINGS_SECTION_ENGINE" ownsChildren className="flex flex-col gap-4">
              <h3 className="font-bold text-lg">Default Playback Engine</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'auto', label: 'Auto (Recommended)', desc: 'Chooses best engine by stream format' },
                  { id: 'hls', label: 'HLS.js Engine', desc: 'Optimized for adaptive m3u8 streams' },
                  { id: 'mpegts', label: 'MPEG-TS Engine', desc: 'Direct transport stream decoding' },
                  { id: 'native', label: 'Native HTML5 Video', desc: 'Hardware-accelerated browser fallback' },
                ].map((eng) => (
                  <FocusableTile
                    key={eng.id}
                    focusKey={`SETTINGS_ENGINE_${eng.id}`}
                    onPress={() => updateSettings({ defaultEngine: eng.id as 'auto' | 'hls' | 'mpegts' | 'native' })}
                    className={`
                      p-4 rounded-2xl text-left border
                      ${settings.defaultEngine === eng.id
                        ? 'bg-[var(--md-sys-color-primary-container)] border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary-container)]'
                        : 'bg-[var(--md-sys-color-surface-container-high)] border-transparent text-[var(--md-sys-color-on-surface)]'
                      }
                    `}
                  >
                    <div className="font-bold text-sm">{eng.label}</div>
                    <div className="text-xs opacity-70 mt-1">{eng.desc}</div>
                  </FocusableTile>
                ))}
              </div>
              </FocusZone>
            </Card>

            <Card variant="filled" isInteractive={false} className="p-6 flex flex-col gap-4">
              <FocusZone focusKey="SETTINGS_SECTION_NERD" ownsChildren className="flex flex-col gap-4">
              <h3 className="font-bold text-lg">Technical Nerd Diagnostics</h3>
              <Button
                variant={settings.showNerdStats ? 'filled' : 'tonal'}
                icon="query_stats"
                onClick={() => updateSettings({ showNerdStats: !settings.showNerdStats })}
              >
                {settings.showNerdStats ? 'Always Show Nerd Stats on Playback' : 'Nerd Stats Hidden by Default'}
              </Button>
              </FocusZone>
            </Card>
          </FocusZone>
        )}

        {/* PLAYLISTS */}
        {activeTab === 'playlists' && (
          editingPlaylist ? (
            <FocusZone focusKey="SETTINGS_SECTION_EPG" ownsChildren className="h-full min-h-0">
              <PlaylistEpgPanel
                playlist={editingPlaylist}
                onClose={() => setEditingPlaylist(null)}
                onChanged={onRefreshData}
              />
            </FocusZone>
          ) : (
            <FocusZone focusKey="SETTINGS_SECTION_PLAYLISTS" ownsChildren className="flex flex-col gap-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg">Installed Playlists</h3>
                <Button variant="filled" icon="add" onClick={onAddNewPlaylist}>
                  Add New Source
                </Button>
              </div>

              {playlists.map((pl) => (
                <div key={pl.id} className="flex flex-col gap-2">
                  {!pl.epgUrl && !pl.epgPromptDismissed && (
                    <EpgFirstRunBanner
                      playlist={pl}
                      onAddGuide={() => setEditingPlaylist(pl)}
                      onDismiss={() => {
                        void savePlaylist({ ...pl, epgPromptDismissed: true }).then(onRefreshData);
                      }}
                    />
                  )}
                  <div className="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base">{pl.name}</h4>
                        {pl.isActive && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--md-sys-color-outline)] mt-0.5">
                        {pl.channelCount} channels • Type: {pl.type.toUpperCase()} • Synced: {new Date(pl.lastSyncedAt).toLocaleDateString()}
                        {pl.epgUrl ? ' • EPG attached' : ' • No EPG'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="filled"
                        icon="schedule"
                        onClick={() => setEditingPlaylist(pl)}
                        className="!px-3 !py-1.5 text-xs"
                      >
                        Edit EPG
                      </Button>
                      <Button
                        variant="tonal"
                        icon="refresh"
                        onClick={onRefreshData}
                        className="!px-3 !py-1.5 text-xs"
                      >
                        Refresh
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </FocusZone>
          )
        )}

        {/* NETWORK & PROXY */}
        {activeTab === 'network' && (
          <FocusZone className="flex flex-col gap-6">
            <Card variant="filled" isInteractive={false} className="p-6 flex flex-col gap-4">
              <FocusZone focusKey="SETTINGS_SECTION_PROXY" ownsChildren className="flex flex-col gap-4">
              <div>
                <h3 className="font-bold text-lg">CORS Proxy Configuration</h3>
                <p className="text-xs text-[var(--md-sys-color-outline)] leading-relaxed mt-1">
                  If your IPTV provider rejects browser cross-origin requests or uses unencrypted HTTP streams on HTTPS,
                  a CORS proxy routes and decrypts the stream to permit uninterrupted playback.
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-[var(--md-sys-color-on-surface)] uppercase tracking-wider mb-2">
                  1-Click Presets for TV Remote
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {PROXY_PRESETS.map((preset) => {
                    const isSelected = proxyTemplate === preset.template;
                    return (
                      <FocusableTile
                        key={preset.id}
                        focusKey={`SETTINGS_PROXY_${preset.id}`}
                        onPress={() => {
                          setProxyTemplate(preset.template);
                          updateSettings({ proxyUrlTemplate: preset.template });
                          setIsSavedMessage(true);
                          setTimeout(() => setIsSavedMessage(false), 2000);
                        }}
                        className={`
                          p-3.5 rounded-2xl text-left border
                          ${isSelected
                            ? 'bg-[var(--md-sys-color-primary-container)] border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary-container)] shadow-sm'
                            : 'bg-[var(--md-sys-color-surface-container-high)] border-transparent text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]'
                          }
                        `}
                      >
                        <div className="font-bold text-xs flex items-center justify-between">
                          <span>{preset.name}</span>
                          {isSelected && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-bold border border-emerald-800">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] opacity-75 mt-1 leading-snug">
                          {preset.description}
                        </div>
                      </FocusableTile>
                    );
                  })}
                </div>
              </div>

              <div className="mt-2 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                <TextField
                  label="Custom Proxy URL Template"
                  value={proxyTemplate}
                  onChange={setProxyTemplate}
                  placeholder="https://my-proxy.example.com/?url={url}"
                  hint="Token {url} will be replaced with the stream URL"
                />

                <div className="flex justify-end mt-3">
                  <Button variant="filled" icon="save" onClick={handleSaveNetwork}>
                    Save Custom Proxy
                  </Button>
                </div>
              </div>
              </FocusZone>
            </Card>

            <Card variant="filled" isInteractive={false} className="p-6 flex flex-col gap-4">
              <FocusZone focusKey="SETTINGS_SECTION_DANGER" ownsChildren className="flex flex-col gap-4">
              <h3 className="font-bold text-lg text-red-400">Danger Zone</h3>
              <p className="text-xs text-[var(--md-sys-color-outline)]">
                Purge all downloaded channel lists, EPG program guides, and history from local IndexedDB storage.
              </p>
              <div>
                <Button variant="outlined" icon="delete_forever" onClick={handleClearAllData} className="!border-red-800 text-red-400">
                  Clear All Local Data & Reset
                </Button>
              </div>
              </FocusZone>
            </Card>
          </FocusZone>
        )}

        {/* ABOUT & LEGAL */}
        {activeTab === 'about' && (
          <Card variant="filled" isInteractive={false} className="p-8 flex flex-col gap-4 leading-relaxed">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] flex items-center justify-center font-bold">
                <Icon name="live_tv" size={28} />
              </div>
              <div>
                <h3 className="font-bold text-xl">Aether IPTV Leanback Player</h3>
                <p className="text-xs text-[var(--md-sys-color-outline)]">Version 1.0.0 • Client-Side Progressive Web App</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] text-xs text-[var(--md-sys-color-on-surface-variant)] space-y-2">
              <h4 className="font-bold text-[var(--md-sys-color-on-surface)] text-sm">Legal Notice & Disclaimer</h4>
              <p>
                Aether IPTV is purely a client-side media player software application. It does not provide, host, bundle, or distribute any copyrighted media streams or TV channels.
              </p>
              <p>
                Users are solely responsible for providing their own legally obtained M3U playlists and Xtream credentials. The included demo playlist consists exclusively of public domain, open-source Blender Foundation movies, and authorized public test feeds.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
