import React from 'react';
import { PRODUCT_FOOTER_CREDIT } from '../product.ts';

/**
 * Attribution credit for the content footer.
 *
 * Deliberately inert: it is a plain paragraph, not a button or an anchor, it is
 * never registered with the spatial-navigation engine, and `pointer-events`
 * is off. A remote cannot open a URL, so this must never become a D-pad stop,
 * swallow a press meant for the content, or be selectable on a TV.
 *
 * Size/colour come from tokens (`--credit-font-size`, M3 on-surface-variant at
 * 60% opacity) so the line stays low-emphasis and scales with the TV UI setting
 * without any per-mount measurement.
 */
export const CopyrightFooter: React.FC = () => (
  <p
    data-testid="app-copyright-footer"
    className="
      shrink-0 whitespace-nowrap select-none pointer-events-none
      font-normal leading-none
      text-[length:var(--credit-font-size)]
      text-[var(--md-sys-color-on-surface-variant)] opacity-60
    "
  >
    {PRODUCT_FOOTER_CREDIT}
  </p>
);
