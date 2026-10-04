import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders.tsx';
import { pressKey } from '../../test/remote.ts';
import { expectFocused } from '../../test/expectFocused.ts';
import { clearContentFocusMemory, rememberContentFocus, setFocus, useFocusable } from '../focus/index.ts';
import { Dialog } from './Dialog.tsx';
import { NavigationRail, type NavDestination } from './NavigationRail.tsx';

const ITEMS: NavDestination[] = [
  { id: 'home', label: 'Home', icon: 'home', path: '/' },
  { id: 'live', label: 'Live TV', icon: 'live_tv', path: '/live' },
  { id: 'guide', label: 'EPG Guide', icon: 'calendar_month', path: '/guide' },
  { id: 'favorites', label: 'Favorites', icon: 'star', path: '/favorites' },
  { id: 'search', label: 'Search', icon: 'search', path: '/search' },
  { id: 'settings', label: 'Settings', icon: 'settings', path: '/settings' },
];

function RailHarness({
  activeId = 'home',
  onNavigate = vi.fn(),
}: {
  activeId?: string;
  onNavigate?: (dest: NavDestination) => void;
}) {
  return <NavigationRail items={ITEMS} activeId={activeId} onNavigate={onNavigate} />;
}

function ContentProbe() {
  const { ref } = useFocusable({ focusKey: 'CONTENT_LEAF' });
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} data-testid="content-leaf">
      content
    </button>
  );
}

describe('NavigationRail', () => {
  it('renders icon-only items labelled through aria-label', () => {
    renderWithProviders(<RailHarness />);

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    for (const item of ITEMS) {
      expect(screen.getByRole('button', { name: item.label })).toBeInTheDocument();
      // No visible label text: the label is announced via aria-label only.
      expect(screen.queryByText(item.label)).toBeNull();
    }

    const rail = screen.getByTestId('navigation-rail');
    expect(rail.querySelectorAll('button')).toHaveLength(ITEMS.length);
    expect(
      rail.querySelectorAll('.material-symbols-rounded[aria-hidden="true"]').length
    ).toBeGreaterThan(0);
  });

  it('marks the active destination with aria-current="page"', () => {
    const { rerender } = renderWithProviders(<RailHarness activeId="home" />);
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Live TV' })).not.toHaveAttribute('aria-current');

    rerender(<RailHarness activeId="guide" />);
    expect(screen.getByRole('button', { name: 'EPG Guide' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('navigates only when OK is pressed on a destination', async () => {
    const onNavigate = vi.fn();
    renderWithProviders(<RailHarness onNavigate={onNavigate} />);

    setFocus('NAV_live');
    await waitFor(() => expectFocused('NAV_live'));
    expect(onNavigate).not.toHaveBeenCalled();

    pressKey('Enter');
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith(ITEMS[1]));
  });

  it('RIGHT returns focus to the remembered content element', async () => {
    renderWithProviders(
      <>
        <RailHarness />
        <ContentProbe />
      </>
    );

    rememberContentFocus('CONTENT_LEAF');
    setFocus('NAV_live');
    await waitFor(() => expectFocused('NAV_live'));

    pressKey('Right');
    await waitFor(() => expectFocused('CONTENT_LEAF'));
  });

  it('BACK closes an overlay before it focuses the rail', async () => {
    function Harness() {
      const [open, setOpen] = React.useState(true);
      return (
        <>
          <RailHarness />
          <Dialog isOpen={open} onClose={() => setOpen(false)} title="Overlay Title">
            body
          </Dialog>
        </>
      );
    }

    renderWithProviders(<Harness />);
    expect(screen.getByText('Overlay Title')).toBeInTheDocument();

    pressKey('Back');
    await waitFor(() => expect(screen.queryByText('Overlay Title')).not.toBeInTheDocument());
    expect(document.activeElement?.getAttribute('aria-label')).not.toBe('Home');

    pressKey('Back');
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Home')
    );
  });

  it('does not leave content focus memory dirty between renders', () => {
    clearContentFocusMemory();
    renderWithProviders(<RailHarness />);
    // A fresh rail without a remembered element must render without throwing.
    expect(screen.getByTestId('navigation-rail')).toBeInTheDocument();
  });
});
