import React, { useEffect } from 'react';
import { useFocusable } from '../focus/index.ts';
import { isEditableElement } from '../input/useTvInput.ts';
import { Icon } from '../icons/index.ts';

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /**
   * Renders the *selected* state (accent tint, accent label, 3px marker).
   * Use `filled` only for the screen's single primary action (ADR 030); a
   * selected toggle is not a primary action.
   */
  selected?: boolean;
  icon?: string;
  focusKey?: string;
  autoFocus?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'filled',
  selected = false,
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

  // State styling is owned by `src/index.css` (ADR 030): `action-primary` is the
  // solid accent fill, `action-secondary` the neutral tonal surface, and
  // `state-selected` the tint + marker pair. No component-level colour here.
  let variantClasses = '';
  switch (variant) {
    case 'filled':
      variantClasses = 'action-primary';
      break;
    case 'tonal':
      variantClasses = 'action-secondary';
      break;
    case 'outlined':
      variantClasses = 'action-outlined';
      break;
    case 'text':
      variantClasses = 'action-text';
      break;
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected ? true : undefined}
      className={`
        tv-focus-target relative inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-base font-medium
        select-none cursor-pointer outline-none shrink-0
        ${disabled ? 'opacity-40 pointer-events-none' : ''}
        ${selected ? 'state-selected state-selected-underline' : variantClasses}
        ${focused ? 'tv-focused' : ''}
        ${className}
      `}
      {...props}
    >
      {icon && <Icon name={icon} size={20} />}
      {children && <span>{children}</span>}
    </button>
  );
};
