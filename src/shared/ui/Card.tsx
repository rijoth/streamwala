import React, { useEffect } from 'react';
import { useFocusable } from '../focus/index.ts';

export type CardVariant = 'filled' | 'elevated' | 'outlined';

export interface CardProps {
  variant?: CardVariant;
  focusKey?: string;
  autoFocus?: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
  isInteractive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  variant = 'filled',
  focusKey,
  autoFocus = false,
  onClick,
  className = '',
  children,
  isInteractive = true,
}) => {
  const { ref, focused, focusSelf } = useFocusable({
    focusKey,
    onEnterPress: () => {
      if (isInteractive && onClick) {
        onClick();
      }
    },
  });

  useEffect(() => {
    if (autoFocus && isInteractive) {
      focusSelf();
    }
  }, [autoFocus, isInteractive, focusSelf]);

  let variantClasses = '';
  switch (variant) {
    case 'filled':
      variantClasses = 'bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface)]';
      break;
    case 'elevated':
      variantClasses = 'bg-[var(--md-sys-color-surface-container-high)] shadow-lg text-[var(--md-sys-color-on-surface)]';
      break;
    case 'outlined':
      variantClasses = 'bg-transparent border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface)]';
      break;
  }

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      onClick={isInteractive ? onClick : undefined}
      className={`
        ${isInteractive ? 'tv-focus-target cursor-pointer' : ''}
        relative rounded-2xl transition-all duration-150 overflow-hidden outline-none
        ${focused && isInteractive ? 'tv-focused ring-4 ring-[var(--md-sys-color-focus-ring)]' : ''}
        ${variantClasses}
        ${className}
      `}
    >
      {children}
    </div>
  );
};
