export const M3_TOKENS = {
  colors: {
    primary: 'var(--md-sys-color-primary)',
    onPrimary: 'var(--md-sys-color-on-primary)',
    primaryContainer: 'var(--md-sys-color-primary-container)',
    onPrimaryContainer: 'var(--md-sys-color-on-primary-container)',
    surface: 'var(--md-sys-color-surface)',
    surfaceDim: 'var(--md-sys-color-surface-dim)',
    surfaceContainer: 'var(--md-sys-color-surface-container)',
    surfaceContainerHigh: 'var(--md-sys-color-surface-container-high)',
    surfaceContainerHighest: 'var(--md-sys-color-surface-container-highest)',
    onSurface: 'var(--md-sys-color-on-surface)',
    onSurfaceVariant: 'var(--md-sys-color-on-surface-variant)',
    outline: 'var(--md-sys-color-outline)',
    outlineVariant: 'var(--md-sys-color-outline-variant)',
    error: 'var(--md-sys-color-error)',
    focusRing: 'var(--sw-focus-ring)',
  },
  elevation: {
    level0: 'none',
    level1: '0 1px 3px 1px rgba(0, 0, 0, 0.35)',
    level2: '0 2px 6px 2px rgba(0, 0, 0, 0.4)',
    level3: '0 4px 12px 3px rgba(0, 0, 0, 0.45)',
  },
  shape: {
    sm: 'var(--md-shape-sm)',
    md: 'var(--md-shape-md)',
    lg: 'var(--md-shape-lg)',
    xl: 'var(--md-shape-xl)',
    full: 'var(--md-shape-full)',
  },
};

/**
 * The four interaction states, each with its own token set (ADR 030).
 *
 * Consumed as class names (`action-primary`, `state-selected`,
 * `status-favorite`, …) rather than raw colours, so one theme file owns every
 * value. Components that need a token in an inline style can use these.
 */
export const STATE_TOKENS = {
  focus: {
    ring: 'var(--sw-focus-ring)',
    surface: 'var(--sw-focus-surface)',
    ringWidth: 'var(--focus-ring-width)',
    ringOffset: 'var(--focus-ring-offset)',
    scale: 'var(--focus-scale)',
    duration: 'var(--focus-motion-duration)',
    easing: 'var(--focus-motion-easing)',
  },
  selected: {
    surface: 'var(--sw-surface-selected)',
    surfaceFocused: 'var(--sw-surface-selected-focus)',
    text: 'var(--sw-accent-text)',
    marker: 'var(--sw-accent-marker)',
  },
  primaryAction: {
    fill: 'var(--sw-accent-primary)',
    label: 'var(--sw-on-accent-primary)',
  },
  secondaryAction: {
    surface: 'var(--sw-surface-secondary)',
    label: 'var(--sw-on-surface-secondary)',
  },
  status: {
    active: 'var(--sw-status-active)',
    activeSurface: 'var(--sw-status-active-surface)',
    onActive: 'var(--sw-on-status-active)',
    favorite: 'var(--sw-status-favorite)',
    favoriteSurface: 'var(--sw-status-favorite-surface)',
    onFavorite: 'var(--sw-on-status-favorite)',
    live: 'var(--sw-status-live)',
    liveSurface: 'var(--sw-status-live-surface)',
    onLive: 'var(--sw-on-status-live)',
  },
} as const;
