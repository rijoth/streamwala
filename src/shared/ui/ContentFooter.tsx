import React from 'react';
import { CopyrightFooter } from './CopyrightFooter.tsx';
import { RemoteHintBar } from './RemoteHintBar.tsx';

export interface ContentFooterProps {
  /** Whether the color-key legend is enabled in Settings → Appearance. */
  showRemoteHints: boolean;
}

/**
 * Single footer row at the bottom of the content safe area.
 *
 * The legend and the attribution share one row, so the credit costs no extra
 * vertical space while hints are on. With hints off the credit stays put and
 * anchors itself to the right edge of the footer instead of disappearing with
 * the legend. The row lives inside `.tv-safe-container`, so the overscan
 * padding that protects the rest of the shell protects it too, and it is
 * unmounted with `<main>` while the fullscreen player is open (never over
 * video).
 */
export const ContentFooter: React.FC<ContentFooterProps> = ({ showRemoteHints }) => (
  <footer
    data-testid="content-footer"
    className={`shrink-0 flex items-center gap-6 pt-3 ${
      showRemoteHints ? 'justify-between' : 'justify-end'
    }`}
  >
    {showRemoteHints && <RemoteHintBar />}
    <CopyrightFooter />
  </footer>
);
