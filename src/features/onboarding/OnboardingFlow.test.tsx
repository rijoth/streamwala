import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders.tsx';
import { pressKey } from '../../test/remote.ts';
import { expectFocused } from '../../test/expectFocused.ts';
import { focusKeyExists, setFocus } from '../../shared/focus/index.ts';
import { OnboardingFlow } from './OnboardingFlow.tsx';

/**
 * The local-file source used to render `<label for>` on a hidden
 * `<input type="file">`: no focusable node, no Select handler, so the picker
 * could only be opened with a mouse. These tests lock the picker into the
 * spatial-navigation tree and prove the remote OK key opens the chooser.
 *
 * Geometry-dependent traversal between the name field, the picker and the
 * action row lives in `e2e/onboarding-file.spec.ts` — jsdom has no layout.
 */
const FILE_CONTROLS = [
  'ONBOARDING_PLAYLIST_NAME',
  'ONBOARDING_FILE_PICKER',
  'ONBOARDING_DETAILS_BACK',
  'ONBOARDING_START_IMPORT',
];

function openFileDetails() {
  const view = renderWithProviders(<OnboardingFlow onComplete={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /Get Started/i }));
  fireEvent.click(screen.getByText('Local M3U File'));
  expect(screen.getByText('Select Local M3U File')).toBeInTheDocument();
  return view;
}

describe('OnboardingFlow local file source is D-pad reachable', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers every file-source control as a navigation stop', () => {
    openFileDetails();

    for (const key of FILE_CONTROLS) {
      expect(focusKeyExists(key), `missing focusable ${key}`).toBe(true);
    }
  });

  it('focuses the picker on entry instead of leaving the screen without focus', async () => {
    openFileDetails();

    await waitFor(() => expectFocused('ONBOARDING_FILE_PICKER'));
    expect(screen.getByTestId('onboarding-file-picker')).toHaveClass('tv-focus-target');
  });

  it('opens the file chooser from the remote OK key', async () => {
    openFileDetails();
    await waitFor(() => expectFocused('ONBOARDING_FILE_PICKER'));

    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
    pressKey('Enter');

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(clickSpy.mock.instances[0]).toBe(screen.getByTestId('onboarding-file-input'));
  });

  it('shows the chosen file name and size on the picker', async () => {
    openFileDetails();
    await waitFor(() => expectFocused('ONBOARDING_FILE_PICKER'));

    await userEvent.upload(
      screen.getByTestId('onboarding-file-input'),
      new File(['#EXTM3U\n#EXTINF:-1 group-title="News",Demo News\nhttps://demo.example.invalid/a.m3u8\n'], 'demo.m3u', {
        type: 'text/plain',
      })
    );

    const picker = screen.getByTestId('onboarding-file-picker');
    await waitFor(() => expect(picker).toHaveTextContent('demo.m3u'));
    expect(picker).toHaveTextContent(/KB ready/);
  });

  it('reaches the primary action from the remote OK key', async () => {
    openFileDetails();

    setFocus('ONBOARDING_START_IMPORT');
    await waitFor(() => expectFocused('ONBOARDING_START_IMPORT'));

    pressKey('Enter');

    await waitFor(() =>
      expect(screen.getByText('Please select a local .m3u or .m3u8 file.')).toBeInTheDocument()
    );
  });
});
