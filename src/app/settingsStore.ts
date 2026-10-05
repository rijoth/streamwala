import { create } from 'zustand';
import { AppSettings, DEFAULT_SETTINGS } from '../domain/types.ts';

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

  // Safe area overscan padding
  if (settings.safePadding) {
    root.style.setProperty('--tv-safe-x', '48px');
    root.style.setProperty('--tv-safe-y', '32px');
  } else {
    root.style.setProperty('--tv-safe-x', '16px');
    root.style.setProperty('--tv-safe-y', '16px');
  }

  // UI scale
  root.style.setProperty('--ui-scale', String(settings.uiScale));
}

// Applied at module load, not from a React effect: the first paint — including
// the pre-React boot splash (ADR 022) — must already be in the stored theme.
// index.html's inline pre-script can only add the theme class, because the
// theme tokens live in this stylesheet, which the module script loads.
if (typeof document !== 'undefined') {
  applyTheme(loadInitialSettings());
}
