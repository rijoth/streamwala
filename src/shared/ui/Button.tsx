import React, { useEffect } from 'react';
import { useFocusable } from '../focus/index.ts';
import { isEditableElement } from '../input/useTvInput.ts';
import { Icon } from '../icons/index.ts';

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: string;
  focusKey?: string;
  autoFocus?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'filled',
  icon,
  focusKey,
  autoFocus = false,
  className = '',
  children,
  onClick,
  disabled,
  ...props
}) => {
  const { ref, focused, focusSelf } = useFocusable({
    focusKey,
    onEnterPress: () => {
      if (!disabled && onClick) {
        onClick({} as React.MouseEvent<HTMLButtonElement>);
      }
    },
  });

  useEffect(() => {
    // Never steal focus from a text input that currently owns the caret, e.g.
    // a screen whose auto-focusing primary action remounts when an inline
    // search query is cleared.
    if (autoFocus && !isEditableElement(document.activeElement)) {
      focusSelf();
    }
  }, [autoFocus, focusSelf]);

  // Variant styling according to M3 tokens
  let variantClasses = '';
  switch (variant) {
    case 'filled':
      variantClasses = 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-semibold';
      break;
    case 'tonal':
      variantClasses = 'bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]';
      break;
    case 'outlined':
      variantClasses = 'bg-transparent border border-[var(--md-sys-color-outline)] text-[var(--md-sys-color-on-surface)]';
      break;
    case 'text':
      variantClasses = 'bg-transparent text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-surface-container-low)]';
      break;
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`
        tv-focus-target relative inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-base font-medium
        select-none cursor-pointer outline-none shrink-0
        ${disabled ? 'opacity-40 pointer-events-none' : ''}
        ${focused ? 'tv-focused' : ''}
        ${variantClasses}
        ${className}
      `}
      {...props}
    >
      {icon && <Icon name={icon} size={20} />}
      {children && <span>{children}</span>}
    </button>
  );
};
