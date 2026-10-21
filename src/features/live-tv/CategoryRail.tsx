import React, { useEffect, useCallback } from 'react';
import {
  ALLOW_DEFAULT_NAVIGATION,
  BLOCK_NAVIGATION,
  FocusZone,
  useFocusable,
  type ArrowHandler,
} from '../../shared/focus/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import {
  minimalScrollOffset,
  useGridScroller,
} from '../../shared/scroll/index.ts';

/** One selectable channel scope: `all`, `favorites` or a playlist group. */
export interface CategoryOption {
  id: string;
  label: string;
  badge: number;
  icon?: string;
}

export const CATEGORY_RAIL_GAP = 8;
/** First-paint fallback; the scroller measures the rem/scale-sized item for real. */
export const CATEGORY_RAIL_ITEM_HEIGHT = 56;

export const categoryFocusKey = (id: string) => `CATEGORY_${id}`;

export interface CategoryRailProps {
  items: CategoryOption[];
  activeId: string;
  onSelect: (id: string) => void;
  /** RIGHT: hand focus to the channel grid (or the search field if empty). */
  onEnterContent: () => void;
}

/**
 * Vertical, D-pad-first replacement for the horizontal chip strip.
 *
 * A left rail keeps every category in the same column, so UP/DOWN is the only
 * axis needed to browse scopes and RIGHT moves into the channel list. Nothing
 * is clipped horizontally, long playlists (100+ groups) scroll vertically, and
 * the rail follows the active scope when it was chosen outside Live TV (e.g. a
 * Home category tile) instead of leaving the selection off-screen.
 */
export const CategoryRail: React.FC<CategoryRailProps> = ({
  items,
  activeId,
  onSelect,
  onEnterContent,
}) => {
  const rail = useGridScroller({
    screenKey: 'live:category-rail',
    count: items.length,
    rowSize: CATEGORY_RAIL_ITEM_HEIGHT + CATEGORY_RAIL_GAP,
    minItemWidth: 1,
    maxColumns: 1,
    columns: 1,
    gap: CATEGORY_RAIL_GAP,
    measureItemHeight: true,
    // The active scope decides the rail position, not a remembered offset.
    restore: false,
  });

  const activeIndex = items.findIndex((item) => item.id === activeId);

  // Keep the selected scope visible when it changed outside the rail. Focus
  // navigation also scrolls, but the app can focus the zone before the viewport
  // has a measured size (returning from Home or the player), in which case the
  // first focus event cannot compute an offset yet.
  useEffect(() => {
    if (activeIndex < 0) return;
    const reveal = () => {
      if (!rail.axis.isSized() || rail.axis.getViewportSize() <= 0) return;
      const target = minimalScrollOffset(
        rail.axis.getOffset(),
        activeIndex,
        rail.rowSize,
        rail.axis.getViewportSize(),
        rail.axis.getContentSize(),
        rail.config
      );
      rail.axis.scrollToOffset(target, { animate: false });
    };
    const unsubscribe = rail.axis.onSized(reveal);
    reveal();
    return unsubscribe;
  }, [activeIndex, rail.axis, rail.rowSize, rail.config]);

  const handleEnterContent = useCallback(() => onEnterContent(), [onEnterContent]);

  return (
    <aside
      aria-label="Channel categories"
      data-testid="category-rail"
      className="shrink-0 w-[var(--category-rail-width)] h-full flex flex-col
        bg-[var(--md-sys-color-surface-container-low)] border-r border-[var(--md-sys-color-outline-variant)]"
    >
      <h2 className="relative z-10 shrink-0 px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider
        bg-[var(--md-sys-color-surface-container-low)] text-[var(--md-sys-color-outline)]">
        Categories
      </h2>
      <FocusZone
        focusKey="CHANNEL_CATEGORIES"
        // Always land on the scope the grid is actually showing.
        saveLastFocusedChild={false}
        preferredChildFocusKey={categoryFocusKey(activeId)}
        className="flex-1 min-h-0"
      >
        <div
          ref={rail.axis.viewportRef}
          data-scroll-axis="vertical"
          data-testid="category-rail-viewport"
          className="relative h-full overflow-hidden"
        >
          <div
            ref={rail.axis.contentRef}
            className="flex flex-col px-[var(--focus-ring-pad)] py-[var(--focus-ring-pad)]"
            style={{ gap: CATEGORY_RAIL_GAP }}
          >
            {items.map((item, index) => (
              <CategoryRailItem
                key={item.id}
                item={item}
                index={index}
                count={items.length}
                selected={item.id === activeId}
                onSelect={() => onSelect(item.id)}
                onEnterContent={handleEnterContent}
              />
            ))}
          </div>
        </div>
      </FocusZone>
    </aside>
  );
};

interface CategoryRailItemProps {
  item: CategoryOption;
  index: number;
  count: number;
  selected: boolean;
  onSelect: () => void;
  onEnterContent: () => void;
}

const CategoryRailItem: React.FC<CategoryRailItemProps> = ({
  item,
  index,
  count,
  selected,
  onSelect,
  onEnterContent,
}) => {
  const arrowHandler: ArrowHandler = (direction) => {
    if (direction === 'right') {
      // Deterministic exit into the channel list; spatial guessing would land
      // on the search field or an arbitrary card depending on the row height.
      onEnterContent();
      return BLOCK_NAVIGATION;
    }
    if (direction === 'up' && index === 0) {
      return BLOCK_NAVIGATION; // no wrap past the first scope
    }
    if (direction === 'down' && index === count - 1) {
      return BLOCK_NAVIGATION; // no wrap past the last scope
    }
    return ALLOW_DEFAULT_NAVIGATION;
  };

  const { ref, focused } = useFocusable({
    focusKey: categoryFocusKey(item.id),
    onEnterPress: onSelect,
    onArrowPress: arrowHandler,
  });

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      title={item.label}
      aria-current={selected ? 'true' : undefined}
      data-scroll-index={index}
      data-category-id={item.id}
      onClick={onSelect}
      className={`
        tv-focus-target shrink-0 w-full h-[var(--category-item-height)] px-3 rounded-xl
        flex items-center gap-3 text-left cursor-pointer outline-none border
        ${
          selected
            ? 'bg-[var(--md-sys-color-secondary-container)] border-[var(--md-sys-color-secondary)] text-[var(--md-sys-color-on-secondary-container)]'
            : 'bg-[var(--md-sys-color-surface-container)] border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]'
        }
        ${focused ? 'tv-focused' : ''}
      `}
    >
      {item.icon && <Icon name={item.icon} size={20} filled={selected} className="shrink-0" />}
      <span className="flex-1 min-w-0 truncate text-sm font-medium">{item.label}</span>
      <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)]">
        {item.badge}
      </span>
    </button>
  );
};
