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
      aria-pressed={selected}
      className={`
        tv-focus-target relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
        cursor-pointer outline-none shrink-0 border
        ${selected ? 'state-selected state-selected-underline' : 'action-secondary border-transparent'}
        ${focused ? 'tv-focused' : ''}
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
