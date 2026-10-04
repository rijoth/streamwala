/**
 * Product identity constants.
 *
 * Single source of truth for user-facing brand strings so the name is not
 * scattered as literals. Pure data — no React, no I/O (domain/shared layer
 * rules).
 *
 * NOTE: storage identifiers are deliberately excluded. Persisted names such as
 * the IndexedDB database (`AetherIptvDatabase`) and localStorage keys
 * (`aether_iptv_settings_v1`) keep their pre-rename values for backward
 * compatibility and must never be derived from these constants.
 * See DECISIONS.md (ADR 019).
 */
export const PRODUCT_NAME = 'Streamwala';

/** URL/package-safe slug. */
export const PRODUCT_SLUG = 'streamwala';

/** Short descriptor used in the HTML title and metadata. */
export const PRODUCT_TAGLINE = '10-Foot TV Player';

export const PRODUCT_DESCRIPTION =
  'Production-grade, 100% client-side IPTV web player designed for 10-foot TV remotes, Android TV, Google TV, desktop, and tablet with Material Design 3.';

export const PRODUCT_VERSION = '1.0.0';
