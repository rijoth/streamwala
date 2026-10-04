import React from 'react';
import { useFocusable } from '../focus/index.ts';
import { Icon } from '../icons/index.ts';

export interface ChipProps {
  label: string;
  selected?: boolean;
  icon?: string;
  onClick?: () => void;
  focusKey?: string;
  className?: string;
  badge?: string | number;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  icon,
  onClick,
  focusKey,
  className = '',
  badge,
}) => {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => {
      onClick?.();
    },
  });

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={onClick}
      className={`
        tv-focus-target inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
        transition-all duration-150 cursor-pointer outline-none shrink-0 border
        ${
          selected
            ? 'bg-[var(--md-sys-color-primary-container)] border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary-container)]'
            : 'bg-[var(--md-sys-color-surface-container-low)] border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container)]'
        }
        ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] scale-105' : ''}
        ${className}
      `}
    >
      {icon && <Icon name={icon} size={18} filled={selected} />}
      <span>{label}</span>
      {badge !== undefined && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)]">
          {badge}
        </span>
      )}
    </button>
  );
};
