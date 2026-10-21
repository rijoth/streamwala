import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders.tsx';
import { ChannelBrowser } from './ChannelBrowser.tsx';
import { ChannelGridCard, ChannelListItem } from './ChannelCards.tsx';
import type { Channel, Group } from '../../domain/types.ts';

function makeChannel(id: string, name: string, groupId: string, groupName: string): Channel {
  return {
    id,
    playlistId: 'pl_test',
    name,
    groupId,
    groupName,
    streamUrl: 'https://example.invalid/stream.m3u8',
    isFavorite: false,
    isHidden: false,
    isLocked: false,
  };
}

const NEWS = 'grp_news';
const SPORTS = 'grp_sports';

const CHANNELS: Channel[] = [
  makeChannel('c1', 'Alpha News', NEWS, 'News'),
  makeChannel('c2', 'Beta Sports', SPORTS, 'Sports'),
  makeChannel('c3', 'Gamma Sports', SPORTS, 'Sports'),
];

const GROUPS: Group[] = [
  { id: NEWS, playlistId: 'pl_test', name: 'News', type: 'live', channelCount: 1 },
  { id: SPORTS, playlistId: 'pl_test', name: 'Sports', type: 'live', channelCount: 2 },
];

const noop = () => {};

function renderBrowser(activeGroupId = 'all') {
  return renderWithProviders(
    <ChannelBrowser
      channels={CHANNELS}
      groups={GROUPS}
      activeGroupId={activeGroupId}
      onSelectGroup={noop}
      onSelectChannel={noop}
      onToggleFavorite={noop}
    />
  );
}

describe('ChannelBrowser inline search', () => {
  it('filters within the current category and reports N of M', async () => {
    const user = userEvent.setup();
    renderBrowser(NEWS);

    expect(screen.getByRole('heading', { name: 'News' })).toBeInTheDocument();
    const input = screen.getByLabelText('Search channels') as HTMLInputElement;
    await user.type(input, 'alpha');

    expect(screen.getByText('Alpha News')).toBeInTheDocument();
    expect(screen.getByText('1 of 1')).toBeInTheDocument();
    expect(screen.queryByText('Beta Sports')).not.toBeInTheDocument();
  });

  it('re-runs the query when the category scope changes', async () => {
    const user = userEvent.setup();
    const { rerender } = renderBrowser('all');

    const input = screen.getByLabelText('Search channels') as HTMLInputElement;
    await user.type(input, 'beta');
    expect(screen.getByText('Beta Sports')).toBeInTheDocument();
    expect(screen.getByText('1 of 3')).toBeInTheDocument();

    rerender(
      <ChannelBrowser
        channels={CHANNELS}
        groups={GROUPS}
        activeGroupId={SPORTS}
        onSelectGroup={noop}
        onSelectChannel={noop}
        onToggleFavorite={noop}
      />
    );

    expect(screen.getByText('Beta Sports')).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.queryByText('Alpha News')).not.toBeInTheDocument();
  });

  it('keeps the filtered result set when toggling list/grid view', async () => {
    const user = userEvent.setup();
    renderBrowser('all');

    const input = screen.getByLabelText('Search channels') as HTMLInputElement;
    await user.type(input, 'sports');
    expect(screen.getByText('2 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /List View/i }));

    expect(screen.getByText('2 of 3')).toBeInTheDocument();
    expect(screen.getByText('Beta Sports')).toBeInTheDocument();
    expect(screen.getByText('Gamma Sports')).toBeInTheDocument();
    expect(screen.queryByText('Alpha News')).not.toBeInTheDocument();
  });

  it('shows a search-specific empty state', async () => {
    const user = userEvent.setup();
    renderBrowser('all');

    const input = screen.getByLabelText('Search channels') as HTMLInputElement;
    await user.type(input, 'zzz');

    expect(screen.getByText('No channels match your search')).toBeInTheDocument();
    expect(screen.getByText('0 of 3')).toBeInTheDocument();
    // The grid viewport stays mounted so the scroller keeps its content ref.
    expect(screen.getByTestId('live-viewport')).toBeInTheDocument();
  });
});

describe('ChannelBrowser category rail', () => {
  it('marks only the active scope and exposes every category as a rail control', () => {
    renderBrowser(SPORTS);

    const rail = screen.getByTestId('category-rail');
    const sports = within(rail).getByRole('button', { name: /Sports/ });
    const news = within(rail).getByRole('button', { name: /News/ });
    const all = within(rail).getByRole('button', { name: /All Channels/ });

    expect(sports).toHaveAttribute('aria-current', 'true');
    expect(news).not.toHaveAttribute('aria-current');
    expect(all).not.toHaveAttribute('aria-current');
  });

  it('selects a scope from the rail', async () => {
    const user = userEvent.setup();
    const onSelectGroup = vi.fn();
    renderWithProviders(
      <ChannelBrowser
        channels={CHANNELS}
        groups={GROUPS}
        activeGroupId="all"
        onSelectGroup={onSelectGroup}
        onSelectChannel={noop}
        onToggleFavorite={noop}
      />
    );

    await user.click(within(screen.getByTestId('category-rail')).getByRole('button', { name: /News/ }));
    expect(onSelectGroup).toHaveBeenCalledWith(NEWS);
  });
});

/**
 * Logo plates are token-driven and the art is 80% of the plate (ADR 034).
 * jsdom cannot measure geometry, so this asserts the contract — the token class
 * on the plate, the inset class on the image — and leaves the pixels to
 * `e2e/logo-size.spec.ts`.
 */
describe('channel logo plates', () => {
  const logoChannel: Channel = {
    ...makeChannel('cl1', 'Logo One', NEWS, 'News'),
    logo: 'https://example.invalid/logo.svg',
  };
  const noLogoChannel = makeChannel('cl2', 'Gamma Sports', SPORTS, 'Sports');

  it('sizes the grid plate from --logo-size-2xl and the art at 80% of it', () => {
    const { container } = renderWithProviders(
      <ChannelGridCard
        channel={logoChannel}
        index={0}
        focusKey="CARD_TEST"
        onSelect={noop}
        onToggleFavorite={noop}
      />
    );

    const plate = container.querySelector('[data-logo-plate="2xl"]') as HTMLElement | null;
    expect(plate).not.toBeNull();
    expect(plate!.className).toContain('w-[var(--logo-size-2xl)]');
    expect(plate!.className).toContain('h-[var(--logo-size-2xl)]');
    // Rem padding on a px-authored plate would change the art ratio.
    expect(plate!.className).not.toMatch(/\bp-\d/);

    const img = plate!.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.className).toContain('w-[80%]');
    expect(img.className).toContain('h-[80%]');
    expect(img.className).toContain('object-contain');
  });

  it('sizes the list plate from --logo-size-md', () => {
    const { container } = renderWithProviders(
      <ChannelListItem
        channel={logoChannel}
        index={0}
        focusKey="ROW_TEST"
        onSelect={noop}
        onToggleFavorite={noop}
      />
    );

    const plate = container.querySelector('[data-logo-plate="md"]') as HTMLElement | null;
    expect(plate).not.toBeNull();
    expect(plate!.className).toContain('w-[var(--logo-size-md)]');
    expect(plate!.className).toContain('h-[var(--logo-size-md)]');
    const img = plate!.querySelector('img') as HTMLImageElement;
    expect(img.className).toContain('w-[80%]');
  });

  it('keeps the initials fallback inside the token plate when there is no logo', () => {
    const { container } = renderWithProviders(
      <ChannelGridCard
        channel={noLogoChannel}
        index={0}
        focusKey="CARD_NO_LOGO"
        onSelect={noop}
        onToggleFavorite={noop}
      />
    );

    const plate = container.querySelector('[data-logo-plate="2xl"]') as HTMLElement | null;
    expect(plate).not.toBeNull();
    expect(plate!.querySelector('img')).toBeNull();
    expect(plate!.textContent).toBe('GA');
  });
});
