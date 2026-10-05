import React from 'react';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '../product.ts';
import markUrl from './brand/streamwala-mark.svg';

export interface AppSplashProps {
  /**
   * True once the boot sequence has settled: the app is mounted underneath and
   * the splash is on its way out.
   */
  leaving?: boolean;
}

/**
 * Full-screen brand splash for the cold boot (ADR 022).
 *
 * Presentational only. The boot sequence, the minimum display time, the fade
 * timing and the timeout live in `app/useAppBoot`; the transition itself and
 * the reduced-motion escape live in `.app-splash` / `.app-splash-mark` in
 * `src/index.css`.
 *
 * The mark is the generated SVG at the size the static pre-React copy in
 * `index.html` and the native splash use, and it sits in the same place inside
 * the same surface colour, so the handover between the native splash, the
 * static copy and this component is invisible.
 */
export const AppSplash: React.FC<AppSplashProps> = ({ leaving = false }) => (
  <div
    data-testid="app-splash"
    role="status"
    aria-live="polite"
    aria-busy={!leaving}
    className={`app-splash fixed inset-0 z-[100] flex flex-col items-center justify-center gap-[var(--brand-splash-gap)] bg-[var(--md-sys-color-surface-dim)] ${
      leaving ? 'opacity-0 pointer-events-none' : 'opacity-100'
    }`}
  >
    <img
      src={markUrl}
      alt=""
      className="app-splash-mark block"
      style={{ width: 'var(--brand-mark-size)', height: 'var(--brand-mark-size)' }}
    />
    <div className="flex flex-col items-center gap-1 text-center">
      <span
        className="font-semibold text-[var(--md-sys-color-on-surface)]"
        style={{ fontSize: 'var(--brand-title-size)' }}
      >
        {PRODUCT_NAME}
      </span>
      <span
        className="text-[var(--md-sys-color-on-surface-variant)]"
        style={{ fontSize: 'var(--brand-tagline-size)' }}
      >
        {PRODUCT_TAGLINE}
      </span>
    </div>
    <span className="sr-only">Loading {PRODUCT_NAME}</span>
  </div>
);
