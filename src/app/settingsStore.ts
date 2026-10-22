import { create } from 'zustand';
import { AppSettings, DEFAULT_SETTINGS } from '../domain/types.ts';
import { DESIGN_PX_EVENT } from '../shared/utils/designPx.ts';

interface SettingsState {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

// Persistent on-device key: intentionally keeps the pre-rename brand string so
// existing user settings survive the rename. Do not rename without a migration.
// See DECISIONS.md (ADR 019).
const STORAGE_KEY = 'aether_iptv_settings_v1';

function loadInitialSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to load settings from localStorage:', e);
  }
  return DEFAULT_SETTINGS;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: loadInitialSettings(),

  updateSettings: (partial) => {
    set((state) => {
      const updated = { ...state.settings, ...partial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save settings:', e);
      }
      applyTheme(updated);
      return { settings: updated };
    });
  },

  resetSettings: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    applyTheme(DEFAULT_SETTINGS);
    set({ settings: DEFAULT_SETTINGS });
  },
}));

export function applyTheme(settings: AppSettings) {
  const root = document.documentElement;

  // Theme variant
  if (settings.theme === 'amoled') {
    root.classList.add('theme-amoled');
    root.classList.remove('theme-light');
  } else if (settings.theme === 'light') {
    root.classList.remove('theme-amoled');
    root.classList.add('theme-light');
  } else {
    root.classList.remove('theme-amoled');
    root.classList.remove('theme-light');
  }

  // Safe area overscan padding, in design px (ADR 035). The CSS unit resolves
  // against the viewport, so this keeps its intended proportion at any canvas.
  if (settings.safePadding) {
    root.style.setProperty('--tv-safe-x', 'calc(48 * var(--u))');
    root.style.setProperty('--tv-safe-y', 'calc(32 * var(--u))');
  } else {
    root.style.setProperty('--tv-safe-x', 'calc(16 * var(--u))');
    root.style.setProperty('--tv-safe-y', 'calc(16 * var(--u))');
  }

  // UI scale multiplies the automatic screen fit. JS consumers of --u (grid
  // column math, carousel offsets) subscribe to this event to re-measure.
  root.style.setProperty('--ui-scale', String(settings.uiScale));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(DESIGN_PX_EVENT));
  }
}

// Applied at module load, not from a React effect: the first paint — including
// the pre-React boot splash (ADR 022) — must already be in the stored theme.
// index.html's inline pre-script can only add the theme class, because the
// theme tokens live in this stylesheet, which the module script loads.
if (typeof document !== 'undefined') {
  applyTheme(loadInitialSettings());
}
