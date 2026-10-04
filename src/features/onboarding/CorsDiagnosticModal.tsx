import React, { useState } from 'react';
import { Dialog, Button } from '../../shared/ui/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import { PROXY_PRESETS } from '../../domain/types.ts';
import { useSettingsStore } from '../../app/settingsStore.ts';
import { installDemoPlaylist, DEMO_PLAYLIST_ID } from '../../services/playlist/demoPlaylist.ts';

export interface CorsDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  failedUrl: string;
  errorDetails?: string;
  onTryDemo: () => void;
  onOpenSettings: () => void;
  onRetryWithProxy?: (template: string) => void;
}

export const CorsDiagnosticModal: React.FC<CorsDiagnosticModalProps> = ({
  isOpen,
  onClose,
  failedUrl,
  errorDetails,
  onTryDemo,
  onOpenSettings,
  onRetryWithProxy,
}) => {
  const { settings, updateSettings } = useSettingsStore();
  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    const matched = PROXY_PRESETS.find(p => p.template === settings.proxyUrlTemplate);
    return matched ? matched.id : settings.proxyUrlTemplate ? 'custom' : 'corsproxy_io';
  });
  const [isUpdatingDemo, setIsUpdatingDemo] = useState(false);

  const isHttpOnHttps =
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    failedUrl.startsWith('http://');

  const isDemoStream =
    failedUrl.includes('mux.dev') ||
    failedUrl.includes('akamaized.net') ||
    failedUrl.includes('akamaihd.net') ||
    failedUrl.includes('unified-streaming.com') ||
    failedUrl.includes('apple.com');

  const selectedPreset = PROXY_PRESETS.find(p => p.id === selectedPresetId);

  const handleApplyPreset = (presetTemplate: string) => {
    updateSettings({ proxyUrlTemplate: presetTemplate });
    if (onRetryWithProxy) {
      onRetryWithProxy(presetTemplate);
    }
    onClose();
  };

  const handleRepairDemoChannels = async () => {
    setIsUpdatingDemo(true);
    try {
      await installDemoPlaylist();
      onTryDemo();
    } catch (e) {
      console.error('Failed to reinstall demo channels:', e);
    } finally {
      setIsUpdatingDemo(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isHttpOnHttps ? 'Mixed Content Restriction (HTTP on HTTPS)' : 'CORS / Stream Network Restriction'}
      icon="warning"
    >
      <div className="flex flex-col gap-4 text-sm text-[var(--md-sys-color-on-surface-variant)] max-w-xl">
        <p className="leading-relaxed">
          {isHttpOnHttps ? (
            <>
              Your web player is loaded over secure <strong className="text-[var(--md-sys-color-on-surface)]">HTTPS</strong>,
              which blocks unencrypted <code className="px-1.5 py-0.5 rounded bg-black/40 text-amber-300 font-mono">http://</code> stream URLs.
              Selecting an HTTPS CORS proxy below tunnels the stream securely, bypassing the browser block.
            </>
          ) : (
            <>
              The streaming server did not provide the required <strong className="text-[var(--md-sys-color-on-surface)]">Access-Control-Allow-Origin (CORS)</strong> headers,
              or returned a stream format requiring a proxy gateway.
            </>
          )}
        </p>

        {/* Failed Stream Details */}
        <div className="p-3 rounded-2xl bg-black/40 border border-red-900/50 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-[var(--md-sys-color-outline)] font-mono">
            <span>Failed Stream URL</span>
            {isHttpOnHttps && <span className="text-amber-400 font-bold">Unencrypted HTTP</span>}
          </div>
          <p className="text-xs font-mono text-[var(--md-sys-color-on-surface)] break-all select-all">
            {failedUrl || 'Unknown stream URL'}
          </p>
          {errorDetails && (
            <p className="text-xs font-mono text-red-300 border-t border-red-900/40 pt-1.5 mt-1 break-all">
              {errorDetails}
            </p>
          )}
        </div>

        {/* 1-Click Proxy Presets */}
        <div className="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-[var(--md-sys-color-on-surface)] flex items-center gap-2">
              <Icon name="bolt" size={18} className="text-amber-400" />
              1-Click Solution: Select a CORS Proxy Preset
            </h4>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {PROXY_PRESETS.filter(p => p.id !== 'none').map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={`
                    p-3 rounded-xl text-left border flex items-center justify-between cursor-pointer transition-all
                    ${isSelected
                      ? 'bg-[var(--md-sys-color-primary-container)] border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary-container)] shadow-sm'
                      : 'bg-[var(--md-sys-color-surface-container-high)] border-transparent text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]'
                    }
                  `}
                >
                  <div className="flex-1 mr-3">
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <Icon name={isSelected ? 'radio_button_checked' : 'radio_button_unchecked'} size={16} />
                      {preset.name}
                    </div>
                    <div className="text-[11px] opacity-75 mt-0.5 ml-5">{preset.description}</div>
                  </div>
                  <Button
                    variant={isSelected ? 'filled' : 'tonal'}
                    className="!px-3 !py-1 text-xs shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyPreset(preset.template);
                    }}
                  >
                    Apply & Play
                  </Button>
                </div>
              );
            })}
          </div>

          {selectedPreset && (
            <Button
              variant="filled"
              icon="play_arrow"
              className="w-full mt-1"
              autoFocus
              onClick={() => handleApplyPreset(selectedPreset.template)}
            >
              Apply {selectedPreset.name} & Retry Stream Now
            </Button>
          )}
        </div>

        {/* Demo channel repair option if user is on demo channels */}
        {isDemoStream && (
          <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-between gap-3">
            <div className="text-xs text-emerald-200">
              <span className="font-bold block">Testing with Legal Demo Channels?</span>
              Updated verified 100% active public test feeds (NASA, DW News, Blender, Apple HLS) are available.
            </div>
            <Button
              variant="tonal"
              icon="verified"
              className="shrink-0 text-xs text-emerald-300 !border-emerald-700"
              disabled={isUpdatingDemo}
              onClick={handleRepairDemoChannels}
            >
              {isUpdatingDemo ? 'Updating...' : 'Reload Verified Feeds'}
            </Button>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-2 pt-2 border-t border-[var(--md-sys-color-outline-variant)]">
          <Button variant="text" onClick={onClose}>
            Close
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="tonal" icon="settings" onClick={onOpenSettings}>
              Configure Custom Proxy
            </Button>
            <Button variant="outlined" icon="smart_display" onClick={onTryDemo}>
              Demo Streams
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
