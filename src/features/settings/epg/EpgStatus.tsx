import React from 'react';
import { LinearProgress } from '../../../shared/ui/index.ts';
import { Icon } from '../../../shared/icons/index.ts';
import type { EpgStatus } from './useEpgManager.ts';

export function relativeTime(ts?: number): string {
  if (!ts) return '';
  const minutes = Math.round((Date.now() - ts) / 60000);
  if (minutes <= 0) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface EpgStatusLineProps {
  status: EpgStatus;
  error?: string | null;
  onRetry?: () => void;
}

export const EpgStatusLine: React.FC<EpgStatusLineProps> = ({ status, error, onRetry }) => {
  let icon = 'schedule';
  let text = 'No guide data yet.';
  let tone = 'text-[var(--md-sys-color-outline)]';

  if (status.phase === 'downloading') {
    icon = 'download';
    text = `Downloading… ${formatBytes(status.bytesReceived)}`;
  } else if (status.phase === 'parsing') {
    icon = 'memory';
    text = `Parsing… ${status.programmesKept} programmes kept`;
  } else if (status.phase === 'ready') {
    icon = 'check_circle';
    tone = 'text-emerald-400';
    text = status.message ?? `Guide updated ${relativeTime(status.updatedAt)}`;
  } else if (status.phase === 'failed') {
    icon = 'error';
    tone = 'text-[var(--md-sys-color-error)]';
    text = error ?? 'Guide refresh failed.';
  }

  const busy = status.phase === 'downloading' || status.phase === 'parsing';

  return (
    <div
      className="flex flex-col gap-2"
      aria-live="polite"
      data-testid="epg-status"
      data-phase={status.phase}
    >
      <div className={`flex items-center gap-2 text-sm font-medium ${tone}`}>
        <Icon name={icon} size={18} />
        <span>{text}</span>
        {status.phase === 'failed' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="ml-2 text-xs font-semibold text-[var(--md-sys-color-primary)] hover:underline cursor-pointer"
          >
            Retry
          </button>
        )}
      </div>
      {busy && <LinearProgress />}
    </div>
  );
};
