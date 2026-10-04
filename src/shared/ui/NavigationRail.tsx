import React, { useEffect } from 'react';
import {
  useFocusable,
  FocusScope,
  setFocus,
  recallContentFocus,
  ALLOW_DEFAULT_NAVIGATION,
  BLOCK_NAVIGATION,
  type ArrowHandler,
} from '../focus/index.ts';
import { pushBackHandler } from '../input/index.ts';
import { Icon } from '../icons/index.ts';

export interface NavDestination {
  id: string;
  /** Accessible (aria) label only — never rendered as visible text. */
  label: string;
  icon: string;
  path: string;
  badge?: number | string;
}

export interface NavigationRailProps {
  items: NavDestination[];
  activeId: string;
  onNavigate: (dest: NavDestination) => void;
}

const RAIL_FOCUS_KEY = 'NAV_RAIL';
const ITEM_FOCUS_KEY = (id: string) => `NAV_${id}`;

/**
 * Permanent, icon-only Material 3 navigation rail.
 *
 * In normal layout flow (never `position: fixed`), never expands and renders no
 * text labels: destinations are announced through `aria-label` only. Active
 * state is the M3 active-indicator pill + filled icon; focus is the D-pad ring.
 */
export const NavigationRail: React.FC<NavigationRailProps> = ({
  items,
  activeId,
  onNavigate,
}) => {
  const { ref, hasFocusedChild } = useFocusable({
    focusKey: RAIL_FOCUS_KEY,
    // LEFT must always land on the *active* destination, never the last visited
    // one, so the zone ignores its own focus memory and uses this preference.
    saveLastFocusedChild: false,
    preferredChildFocusKey: ITEM_FOCUS_KEY(activeId),
    // Keep D-pad movement inside the rail for these directions; RIGHT is the
    // only exit (handled per item with focus memory).
    isFocusBoundary: true,
    focusBoundaryDirections: ['left', 'up', 'down'],
  });

  // BACK from content focuses the rail first. On the rail itself we leave BACK
  // to the existing dialog/exit handling (overlays are stacked above this).
  useEffect(() => {
    if (hasFocusedChild) return;
    return pushBackHandler(() => {
      setFocus(ITEM_FOCUS_KEY(activeId));
      return true;
    });
  }, [hasFocusedChild, activeId]);

  const settings = items.find((item) => item.id === 'settings');
  const destinations = items.filter((item) => item.id !== 'settings');

  const renderItem = (item: NavDestination, index: number) => (
    <NavRailItem
      key={item.id}
      item={item}
      isActive={item.id === activeId}
      isFirst={index === 0}
      isLast={false}
      onActivate={() => onNavigate(item)}
    />
  );

  return (
    <aside
      ref={ref as React.Ref<HTMLElement>}
      role="navigation"
      aria-label="Primary"
      data-testid="navigation-rail"
      className="relative shrink-0 h-full w-[var(--rail-width)] flex flex-col items-center justify-between py-6
        bg-[var(--md-sys-color-surface-container)] border-r border-[var(--md-sys-color-outline-variant)]"
    >
      {/* Brand mark only — decorative and non-focusable. */}
      <div
        aria-hidden="true"
        className="w-12 h-12 rounded-2xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] flex items-center justify-center shrink-0"
      >
        <Icon name="live_tv" size={26} />
      </div>

      {/* Destination group, vertically centred. FocusScope makes the items
          children of NAV_RAIL so the zone's focus rules apply. */}
      <FocusScope focusKey={RAIL_FOCUS_KEY}>
        <div className="flex flex-col items-center gap-3">
          {destinations.map((item, index) => renderItem(item, index))}
        </div>

        {/* Settings pinned to the bottom of the rail. */}
        {settings && (
          <NavRailItem
            item={settings}
            isActive={settings.id === activeId}
            isFirst={false}
            isLast
            onActivate={() => onNavigate(settings)}
          />
        )}
      </FocusScope>
    </aside>
  );
};

interface NavRailItemProps {
  item: NavDestination;
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
  onActivate: () => void;
}

const NavRailItem: React.FC<NavRailItemProps> = ({
  item,
  isActive,
  isFirst,
  isLast,
  onActivate,
}) => {
  const arrowHandler: ArrowHandler = (direction) => {
    if (direction === 'right') {
      const target = recallContentFocus();
      if (target) {
        setFocus(target);
        return BLOCK_NAVIGATION; // rail exits to the remembered content element
      }
      return ALLOW_DEFAULT_NAVIGATION;
    }
    if (direction === 'left') {
      return BLOCK_NAVIGATION; // rail is the leftmost column; focus must not leak
    }
    if (direction === 'up' && isFirst) {
      return BLOCK_NAVIGATION; // no wrap past the first destination
    }
    if (direction === 'down' && isLast) {
      return BLOCK_NAVIGATION; // no wrap past the last destination
    }
    return ALLOW_DEFAULT_NAVIGATION;
  };

  const { ref, focused } = useFocusable({
    focusKey: ITEM_FOCUS_KEY(item.id),
    onEnterPress: onActivate,
    onArrowPress: arrowHandler,
  });

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
      onClick={onActivate}
      className={`
        tv-focus-target tv-rail-item relative shrink-0 flex items-center justify-center rounded-full outline-none
        w-[var(--rail-item-size)] h-[var(--rail-item-size)]
        transition-transform duration-150 ease-out motion-reduce:transition-none
        ${isActive
          ? 'bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]'
          : 'text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]'}
        ${focused ? 'scale-[1.06] ring-[3px] ring-[var(--md-sys-color-primary)] z-20 motion-reduce:scale-100' : ''}
      `}
    >
      <Icon name={item.icon} size="var(--rail-icon-size)" filled={isActive} />
    </button>
  );
};
