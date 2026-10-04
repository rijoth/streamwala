import React, { useState } from 'react';
import { FocusZone, useFocusable } from '../focus/index.ts';
import { Icon } from '../icons/index.ts';

export interface NavDestination {
  id: string;
  label: string;
  icon: string;
  path: string;
  badge?: number | string;
}

export interface NavigationRailProps {
  destinations: NavDestination[];
  activeId: string;
  onSelect: (dest: NavDestination) => void;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  destinations,
  activeId,
  onSelect,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={`
        fixed left-0 top-0 bottom-0 z-40 transition-all duration-300 ease-out flex flex-col justify-between py-6 px-3
        bg-[var(--md-sys-color-surface-container-low)] border-r border-[var(--md-sys-color-outline-variant)] shadow-2xl
        ${isExpanded ? 'w-64' : 'w-20'}
      `}
    >
      {/* Brand logo header */}
      <div className="flex items-center gap-3 px-2 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] flex items-center justify-center font-bold text-lg shrink-0 shadow-md">
          <Icon name="live_tv" size={24} />
        </div>
        {isExpanded && (
          <div className="overflow-hidden whitespace-nowrap transition-opacity duration-200">
            <h1 className="font-bold text-lg tracking-tight text-[var(--md-sys-color-on-surface)] leading-tight">
              Aether IPTV
            </h1>
            <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Leanback Edition</p>
          </div>
        )}
      </div>

      {/* Nav destinations list */}
      <FocusZone
        focusKey="NAV_RAIL"
        className="flex-1 flex flex-col gap-2 overflow-y-auto overflow-x-hidden py-2"
      >
        {destinations.map((dest) => (
          <NavRailItem
            key={dest.id}
            destination={dest}
            isActive={dest.id === activeId}
            isExpanded={isExpanded}
            onSelect={() => onSelect(dest)}
            onFocusChange={(focused) => {
              if (focused) setIsExpanded(true);
            }}
          />
        ))}
      </FocusZone>

      {/* Bottom Hint Legend */}
      <div className="mt-4 px-2 text-xs text-[var(--md-sys-color-outline)]">
        {isExpanded ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
              <span>Favs</span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block ml-1" />
              <span>Guide</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
              <span>Search</span>
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block ml-1" />
              <span>Settings</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 opacity-60">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <div className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
        )}
      </div>
    </aside>
  );
};

interface NavRailItemProps {
  destination: NavDestination;
  isActive: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onFocusChange: (focused: boolean) => void;
}

const NavRailItem: React.FC<NavRailItemProps> = ({
  destination,
  isActive,
  isExpanded,
  onSelect,
  onFocusChange,
}) => {
  const { ref, focused } = useFocusable({
    focusKey: `NAV_${destination.id}`,
    onEnterPress: onSelect,
    onArrowPress: (direction) => {
      // If pressing Right on the nav rail, leave the rail and enter the main content area
      if (direction === 'right') {
        return false;
      }
      return true;
    },
  });

  React.useEffect(() => {
    onFocusChange(focused);
  }, [focused, onFocusChange]);

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={onSelect}
      className={`
        tv-focus-target w-full flex items-center gap-4 px-3.5 py-3 rounded-2xl cursor-pointer outline-none
        transition-all duration-150 select-none text-left shrink-0
        ${
          isActive
            ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] font-semibold shadow-sm'
            : 'text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container)] hover:text-[var(--md-sys-color-on-surface)]'
        }
        ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] !bg-[var(--md-sys-color-primary)] !text-[var(--md-sys-color-on-primary)] scale-105' : ''}
      `}
    >
      <div className="shrink-0 flex items-center justify-center">
        <Icon name={destination.icon} size={24} filled={isActive || focused} />
      </div>
      {isExpanded && (
        <span className="text-base whitespace-nowrap overflow-hidden text-ellipsis flex-1">
          {destination.label}
        </span>
      )}
      {isExpanded && destination.badge !== undefined && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)]">
          {destination.badge}
        </span>
      )}
    </button>
  );
};
