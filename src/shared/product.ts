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

/**
 * Attribution shown in the app-shell footer and in Settings → About.
 *
 * The credit is one derived value so a new author, year or repository URL is a
 * single-line edit. It is rendered as plain text only: a TV remote cannot open
 * links, so nothing here may become an `<a>` or a focusable control.
 */
export const PRODUCT_AUTHOR = 'Rijo Thomas';

/** Copyright year of the shipped release. */
export const PRODUCT_COPYRIGHT_YEAR = 2026;

/** Public project repository, full URL (Settings → About shows this verbatim). */
export const PRODUCT_REPOSITORY = 'https://github.com/rijoth/streamwala';

/** Repository URL without the scheme, for the space-limited shell footer. */
export const PRODUCT_REPOSITORY_LABEL = PRODUCT_REPOSITORY.replace(/^https?:\/\//, '');

/** `© 2026 Rijo Thomas` — the copyright half of every attribution line. */
export const PRODUCT_COPYRIGHT = `© ${PRODUCT_COPYRIGHT_YEAR} ${PRODUCT_AUTHOR}`;

/** Complete shell-footer credit line: `© 2026 Rijo Thomas · github.com/rijoth/streamwala`. */
export const PRODUCT_FOOTER_CREDIT = `${PRODUCT_COPYRIGHT} · ${PRODUCT_REPOSITORY_LABEL}`;
