import React, { useEffect, useState } from 'react';
import { Icon } from '../icons/index.ts';

export interface ChannelNumberOverlayProps {
  /** Digits typed so far; empty once entry commits or cancels. */
  digits: string;
  /** "Channel N not found" while the not-found message is alive. */
  message: string | null;
}

const EXIT_MS = 140;

/**
 * Non-focusable top-right entry overlay. It lives inside the overscan safe
 * area, only animates opacity/transform, and never enters the spatial focus
 * graph, so D-pad focus stays exactly where it was.
 */
export const ChannelNumberOverlay: React.FC<ChannelNumberOverlayProps> = ({
  digits,
  message,
}) => {
  const visible = digits.length > 0 || message !== null;
  const [rendered, setRendered] = useState(visible);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      setClosing(false);
      return;
    }
    if (!rendered) return;
    setClosing(true);
    const timer = setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, EXIT_MS);
    return () => clearTimeout(timer);
  }, [visible, rendered]);

  if (!rendered || (!digits && !message)) return null;

  return (
    <div
      data-testid="channel-number-overlay"
      data-closing={closing ? 'true' : 'false'}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sw-channel-number-overlay fixed z-[60] top-[var(--tv-safe-y)] right-[var(--tv-safe-x)] pointer-events-none select-none"
    >
      <div className="flex items-center gap-4 rounded-3xl border-2 border-[var(--md-sys-color-primary)] bg-black/85 px-6 py-4 shadow-2xl backdrop-blur-md">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]">
          <Icon name={message ? 'error' : 'dialpad'} size={24} />
        </div>
        {digits ? (
          <div className="flex items-baseline gap-1 font-mono font-black tracking-[0.15em] text-[var(--md-sys-color-primary)]">
            <span className="sw-channel-number-digits" style={{ fontSize: 'var(--channel-number-entry-font-size)' }}>
              {digits}
            </span>
            <span
              aria-hidden="true"
              className="sw-channel-number-caret text-[var(--md-sys-color-primary)]"
              style={{ fontSize: 'var(--channel-number-entry-font-size)' }}
            >
              _
            </span>
          </div>
        ) : (
          <div className="max-w-[18rem] text-base font-semibold text-[var(--md-sys-color-error)]">
            {message}
          </div>
        )}
      </div>
    </div>
  );
};
