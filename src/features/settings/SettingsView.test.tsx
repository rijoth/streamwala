import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders.tsx';
import userEvent from '@testing-library/user-event';
import { pressKey } from '../../test/remote.ts';
import { focusKeyExists, getCurrentFocusKey, setFocus } from '../../shared/focus/index.ts';
import { useSettingsStore } from '../../app/settingsStore.ts';
import { SettingsView } from './SettingsView.tsx';

/**
 * BUG-020 regression: every settings control must be registered with the
 * spatial-navigation engine, because only registered components are D-pad stops
 * and only they receive `onEnterPress` from the remote OK key. The styled raw
 * `<button>` tiles used to be invisible to the engine, so the whole screen was
 * a dead end.
 *
 * Geometry-dependent traversal (focus actually moving between rows) lives in
 * `e2e/settings-dpad.spec.ts`; jsdom has no layout.
 */
const CONTROL_KEYS = [
  'SETTINGS_TAB_appearance',
  'SETTINGS_TAB_playback',
  'SETTINGS_TAB_playlists',
  'SETTINGS_TAB_network',
  'SETTINGS_TAB_about',
  'SETTINGS_SECTION_THEME',
  'SETTINGS_SECTION_SAFE_AREA',
  'SETTINGS_SECTION_HINTS',
  'SETTINGS_SECTION_SCALE',
];

function renderSettings() {
  return renderWithProviders(
    <SettingsView playlists={[]} onAddNewPlaylist={() => {}} onRefreshData={() => {}} />
  );
}

describe('SettingsView D-pad reachability (BUG-020)', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetSettings();
  });

  it('registers every settings control as a navigation stop', () => {
    renderSettings();

    for (const key of CONTROL_KEYS) {
      expect(focusKeyExists(key), `missing focusable ${key}`).toBe(true);
    }
  });

  it('switches panels from the remote OK key while a tab tile is focused', async () => {
    renderSettings();

    setFocus('SETTINGS_TAB_playback');
    await waitFor(() => expect(getCurrentFocusKey()).toBe('SETTINGS_TAB_playback'));

    pressKey('Enter');

    await waitFor(() =>
      expect(screen.getByText('Default Playback Engine')).toBeInTheDocument()
    );
    expect(screen.queryByText('TV Overscan Safe Area')).not.toBeInTheDocument();
    expect(focusKeyExists('SETTINGS_ENGINE_hls')).toBe(true);
  });

  it('activates the focused tile from the remote OK key', async () => {
    renderSettings();

    setFocus('SETTINGS_TAB_playback');
    await waitFor(() => expect(getCurrentFocusKey()).toBe('SETTINGS_TAB_playback'));
    pressKey('Enter');
    await waitFor(() => expect(focusKeyExists('SETTINGS_ENGINE_hls')).toBe(true));

    setFocus('SETTINGS_ENGINE_hls');
    await waitFor(() => expect(getCurrentFocusKey()).toBe('SETTINGS_ENGINE_hls'));

    pressKey('Enter');

    await waitFor(() => expect(useSettingsStore.getState().settings.defaultEngine).toBe('hls'));
  });

  it('toggles the channel-switch sound preference from the remote OK key', async () => {
    renderSettings();

    setFocus('SETTINGS_TAB_playback');
    await waitFor(() => expect(getCurrentFocusKey()).toBe('SETTINGS_TAB_playback'));
    pressKey('Enter');
    await waitFor(() => expect(focusKeyExists('SETTINGS_SOUND_TOGGLE')).toBe(true));

    setFocus('SETTINGS_SOUND_TOGGLE');
    await waitFor(() => expect(getCurrentFocusKey()).toBe('SETTINGS_SOUND_TOGGLE'));
    expect(useSettingsStore.getState().settings.channelSwitchSound).toBe(true);

    pressKey('Enter');

    await waitFor(() =>
      expect(useSettingsStore.getState().settings.channelSwitchSound).toBe(false)
    );
  });

  it('offers the reduced TV UI scale factors and applies them', async () => {
    renderSettings();

    for (const label of ['60%', '70%', '80%', '90%', '100%', '110%', '125%']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole('button', { name: '60%' }));

    await waitFor(() => expect(useSettingsStore.getState().settings.uiScale).toBe(0.6));
    expect(document.documentElement.style.getPropertyValue('--ui-scale')).toBe('0.6');
  });

  it('shows the author credit and full repository URL in the About tab', async () => {
    renderSettings();

    setFocus('SETTINGS_TAB_about');
    await waitFor(() => expect(getCurrentFocusKey()).toBe('SETTINGS_TAB_about'));
    pressKey('Enter');

    const credit = await screen.findByTestId('settings-copyright-credit');
    expect(credit).toHaveTextContent('© 2026 Rijo Thomas');
    expect(credit).toHaveTextContent('https://github.com/rijoth/streamwala');
    // Plain text only: a remote cannot follow a link.
    expect(credit.querySelector('a')).toBeNull();
  });
});
