import React, { useRef, useState } from 'react';
import { Button, Card, TextField } from '../../../shared/ui/index.ts';
import { Icon } from '../../../shared/icons/index.ts';
import { FocusZone } from '../../../shared/focus/index.ts';
import { redactEpgUrl } from '../../../services/epg/fetcher.ts';
import { EpgStatusLine, relativeTime } from './EpgStatus.tsx';
import type { EpgManager } from './useEpgManager.ts';

export interface EpgSourceSectionProps {
  manager: EpgManager;
  onSourceAdded?: (url: string) => void;
}

export const EpgSourceSection: React.FC<EpgSourceSectionProps> = ({ manager, onSourceAdded }) => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addRemote = async (sourceUrl: string, sourceName?: string) => {
    const trimmed = sourceUrl.trim();
    if (!trimmed) return;
    await manager.addSource({ name: sourceName || trimmed, url: trimmed, kind: 'remote' });
    onSourceAdded?.(trimmed);
    setUrl('');
    setName('');
  };

  return (
    <div className="flex flex-col gap-4">
      <EpgStatusLine
        status={manager.status}
        error={manager.error}
        onRetry={() => void manager.refresh()}
      />

      {manager.suggestions.length > 0 && (
        <div className="flex flex-col gap-2 p-3 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]">
          <span className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)]">
            Detected from this playlist — add with one tap:
          </span>
          <div className="flex flex-wrap gap-2">
            {manager.suggestions.map((suggestion) => (
              <Button
                key={suggestion.url}
                variant="tonal"
                icon="add"
                className="!px-3 !py-1.5 text-xs"
                onClick={() => void addRemote(suggestion.url, suggestion.label)}
              >
                {suggestion.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <TextField
          label="XMLTV EPG URL"
          value={url}
          onChange={setUrl}
          placeholder="https://example.invalid/epg.xml"
          type="url"
          icon="link"
          focusKey="EPG_ADD_URL"
          onSubmit={() => void addRemote(url, name)}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="filled" icon="add" onClick={() => void addRemote(url, name)}>
            Add source
          </Button>
          <Button
            variant="outlined"
            icon="travel_explore"
            onClick={() => void manager.detect()}
            disabled={manager.detecting}
          >
            {manager.detecting ? 'Detecting…' : 'Detect from playlist'}
          </Button>
          <Button variant="outlined" icon="upload_file" onClick={() => fileInputRef.current?.click()}>
            Import file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,.xmltv,.gz,application/xml,application/gzip"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void manager.importFile(file);
              event.target.value = '';
            }}
          />
        </div>
      </div>

      {manager.sources.length === 0 ? (
        <Card variant="outlined" isInteractive={false} className="p-4 text-sm text-[var(--md-sys-color-outline)]">
          No EPG sources attached. Add a URL, detect one from the playlist header, or import an
          XMLTV file locally.
        </Card>
      ) : (
        <FocusZone focusKey="EPG_SOURCES" ownsChildren className="flex flex-col gap-2">
          {manager.sources.map((source, index) => (
            <div
              key={source.id}
              data-testid={`epg-source-${source.id}`}
              className="p-3 rounded-2xl bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon
                      name={source.enabled ? 'check_circle' : 'pause_circle'}
                      size={16}
                      className={source.enabled ? 'text-emerald-400' : 'text-[var(--md-sys-color-outline)]'}
                    />
                    <span className="font-semibold text-sm truncate">{source.name}</span>
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-outline)]">
                      {source.kind}
                    </span>
                  </div>
                  {source.url && (
                    <p className="text-xs font-mono text-[var(--md-sys-color-outline)] truncate mt-0.5">
                      {redactEpgUrl(source.url)}
                    </p>
                  )}
                  <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                    {source.channelCount} channels · {source.programmeCount} programmes ·{' '}
                    {typeof source.matchRate === 'number'
                      ? `${Math.round(source.matchRate * 100)}% matched`
                      : 'not matched yet'}{' '}
                    · updated {relativeTime(source.lastUpdatedAt) || 'never'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="tonal"
                  icon="refresh"
                  className="!px-3 !py-1.5 text-xs"
                  disabled={manager.refreshingSourceId === source.id}
                  onClick={() => void manager.refresh(source.id)}
                >
                  {manager.refreshingSourceId === source.id ? 'Refreshing…' : 'Refresh now'}
                </Button>
                <Button
                  variant="text"
                  className="!px-3 !py-1.5 text-xs"
                  onClick={() => void manager.setSourceEnabled(source.id, !source.enabled)}
                >
                  {source.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  variant="text"
                  icon="arrow_upward"
                  aria-label="Move source up"
                  className="!px-2 !py-1.5 text-xs"
                  disabled={index === 0}
                  onClick={() => void manager.moveSource(source.id, -1)}
                />
                <Button
                  variant="text"
                  icon="arrow_downward"
                  aria-label="Move source down"
                  className="!px-2 !py-1.5 text-xs"
                  disabled={index === manager.sources.length - 1}
                  onClick={() => void manager.moveSource(source.id, 1)}
                />
                <Button
                  variant="text"
                  icon="delete"
                  className="!px-3 !py-1.5 text-xs text-[var(--md-sys-color-error)]"
                  onClick={() => void manager.removeSource(source.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </FocusZone>
      )}

      {manager.sources.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="tonal" icon="download" onClick={() => void manager.refresh()}>
            Refresh all sources
          </Button>
          <Button
            variant="text"
            icon="delete_sweep"
            className="text-[var(--md-sys-color-error)]"
            onClick={() => void manager.clearAll()}
          >
            Clear EPG data
          </Button>
        </div>
      )}
    </div>
  );
};
