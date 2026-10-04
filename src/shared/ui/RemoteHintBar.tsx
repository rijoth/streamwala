import React from 'react';

interface RemoteHint {
  id: string;
  label: string;
  color: string;
}

/**
 * Colored-dot legend for the remote color keys, relocated out of the rail to a
 * slim footer inside the content safe area. Purely informational: the shortcuts
 * themselves are handled by the app-level input layer.
 */
const REMOTE_HINTS: RemoteHint[] = [
  { id: 'red', label: 'Favs', color: 'var(--streamwala-color-key-red)' },
  { id: 'green', label: 'Guide', color: 'var(--streamwala-color-key-green)' },
  { id: 'yellow', label: 'Search', color: 'var(--streamwala-color-key-yellow)' },
  { id: 'blue', label: 'Settings', color: 'var(--streamwala-color-key-blue)' },
];

export const RemoteHintBar: React.FC = () => (
  <div
    data-testid="remote-hint-bar"
    className="shrink-0 flex items-center gap-6 pt-3 text-xs text-[var(--md-sys-color-on-surface-variant)]"
  >
    {REMOTE_HINTS.map((hint) => (
      <span key={hint.id} className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: hint.color }}
        />
        <span>{hint.label}</span>
      </span>
    ))}
  </div>
);
