import React from 'react';
import { PRODUCT_COPYRIGHT, PRODUCT_NAME, PRODUCT_REPOSITORY_LABEL } from '../product.ts';
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
 *
 * The attribution below the wordmark is plain text pulled from the same
 * `shared/product` constants as the shell footer and Settings → About. It must
 * never become a link or a D-pad stop (a TV remote cannot open one), and it is
 * absolutely positioned so it hangs *below* the centred mark+wordmark group
 * instead of pushing the mark off centre.
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
    <div className="relative flex flex-col items-center gap-1 text-center">
      <span
        className="font-semibold text-[var(--md-sys-color-on-surface)]"
        style={{ fontSize: 'var(--brand-title-size)' }}
      >
        {PRODUCT_NAME}
      </span>
      {/* `top-full` + `mt-1` keeps the same 4px rhythm the subtitle had. */}
      <div
        data-testid="app-splash-credit"
        className="absolute left-1/2 top-full mt-1 flex w-max -translate-x-1/2 flex-col items-center gap-[var(--brand-credit-gap)] whitespace-nowrap text-center font-normal text-[var(--md-sys-color-on-surface-variant)] select-none pointer-events-none"
      >
        <span style={{ fontSize: 'var(--brand-credit-size)' }}>{PRODUCT_COPYRIGHT}</span>
        {/* 6.5vw only ever engages on narrow touch viewports: on a 1280-wide TV
            the token (22px x ui-scale) is always the smaller value, so the URL
            stays one unclipped line without wrapping. */}
        <span
          className="opacity-[0.65]"
          style={{ fontSize: 'min(var(--brand-credit-url-size), 6.5vw)' }}
        >
          {PRODUCT_REPOSITORY_LABEL}
        </span>
      </div>
    </div>
    <span className="sr-only">Loading {PRODUCT_NAME}</span>
  </div>
);
