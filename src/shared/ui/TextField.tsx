import React, { useRef, useState } from 'react';
import { setFocus, useFocusable } from '../focus/index.ts';
import { Icon } from '../icons/index.ts';
import { VirtualKeyboard } from './VirtualKeyboard.tsx';

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'url';
  icon?: string;
  error?: string;
  focusKey?: string;
  autoFocus?: boolean;
  className?: string;
  onSubmit?: () => void;
  hint?: string;
  /**
   * `compact` drops the visible label row and trailing keyboard text so the
   * field can sit inline on a browse screen. The label survives as the input's
   * accessible name; Enter-to-edit and the virtual keyboard are unchanged.
   */
  variant?: 'default' | 'compact';
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  icon,
  error,
  focusKey,
  autoFocus = false,
  className = '',
  onSubmit,
  hint,
  variant = 'default',
}) => {
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isCompact = variant === 'compact';

  const { ref, focused } = useFocusable({
    focusKey,
    autoFocus,
    onEnterPress: () => {
      // Focus the input to invoke TV OS keyboard or open virtual keyboard
      if (inputRef.current) {
        inputRef.current.focus();
      }
    },
  });

  const input = (
    <input
      ref={inputRef}
      type={type}
      value={value}
      aria-label={isCompact ? label : undefined}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => {
        // Keep the spatial-navigation cursor on this field when the DOM input
        // takes the caret (mouse/touch or Enter). Without it the engine still
        // believes a previously auto-focused action owns focus, and remounting
        // that action later (e.g. clearing an inline search) would grab the
        // caret back.
        if (focusKey) setFocus(focusKey);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onSubmit) {
          onSubmit();
        }
      }}
      className={
        isCompact
          ? 'w-full min-w-0 bg-transparent text-[var(--md-sys-color-on-surface)] text-sm outline-none placeholder:text-[var(--md-sys-color-outline)]'
          : 'w-full bg-transparent text-[var(--md-sys-color-on-surface)] text-base outline-none placeholder:text-[var(--md-sys-color-outline)]'
      }
    />
  );

  if (isCompact) {
    return (
      <div className={`w-full ${className}`}>
        <div
          ref={ref as React.Ref<HTMLDivElement>}
          data-text-entry="true"
          className={`
            tv-focus-target tv-flat relative flex items-center gap-2 px-3 py-2 rounded-xl
            bg-[var(--md-sys-color-surface-container)] border
            ${error ? 'border-[var(--md-sys-color-error)]' : 'border-[var(--md-sys-color-outline-variant)]'}
            ${focused ? 'tv-focused' : ''}
          `}
        >
          {icon && (
            <Icon
              name={icon}
              size={18}
              className="text-[var(--md-sys-color-on-surface-variant)] shrink-0"
            />
          )}
          {input}
          <button
            type="button"
            onClick={() => setShowVirtualKeyboard(true)}
            aria-label="Remote Keyboard"
            title="Remote Keyboard"
            className="shrink-0 p-1 text-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-on-surface)] cursor-pointer"
          >
            <Icon name="keyboard" size={18} />
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="Clear search"
              className="shrink-0 p-1 text-[var(--md-sys-color-outline)] hover:text-[var(--md-sys-color-on-surface)] cursor-pointer"
            >
              <Icon name="cancel" size={18} />
            </button>
          )}
        </div>

        {hint && !error && (
          <span className="text-xs text-[var(--md-sys-color-on-surface-variant)] px-1">{hint}</span>
        )}
        {error && (
          <span className="text-xs text-[var(--md-sys-color-error)] px-1 flex items-center gap-1 font-medium">
            <Icon name="error" size={14} />
            {error}
          </span>
        )}

        {showVirtualKeyboard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <VirtualKeyboard
              title={`Enter ${label}`}
              value={value}
              onChange={onChange}
              onSubmit={() => {
                setShowVirtualKeyboard(false);
                onSubmit?.();
              }}
              onClose={() => setShowVirtualKeyboard(false)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label className="text-sm font-medium text-[var(--md-sys-color-on-surface-variant)] min-w-0">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowVirtualKeyboard(true)}
          className="text-xs text-[var(--md-sys-color-primary)] hover:underline flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
        >
          <Icon name="keyboard" size={14} />
          <span>Remote Keyboard</span>
        </button>
      </div>

      <div
        ref={ref as React.Ref<HTMLDivElement>}
        data-text-entry="true"
        className={`
          tv-focus-target tv-flat relative flex items-center gap-3 px-4 py-3 rounded-2xl
          bg-[var(--md-sys-color-surface-container)] border transition-colors duration-150
          ${error ? 'border-[var(--md-sys-color-error)]' : 'border-[var(--md-sys-color-outline-variant)]'}
          ${focused ? 'tv-focused' : ''}
        `}
      >
        {icon && (
          <Icon name={icon} size={20} className="text-[var(--md-sys-color-on-surface-variant)] shrink-0" />
        )}
        {input}
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[var(--md-sys-color-outline)] hover:text-[var(--md-sys-color-on-surface)] p-1 cursor-pointer"
          >
            <Icon name="cancel" size={18} />
          </button>
        )}
      </div>

      {hint && !error && (
        <span className="text-xs text-[var(--md-sys-color-on-surface-variant)] px-1">{hint}</span>
      )}
      {error && (
        <span className="text-xs text-[var(--md-sys-color-error)] px-1 flex items-center gap-1 font-medium">
          <Icon name="error" size={14} />
          {error}
        </span>
      )}

      {/* In-app Virtual Keyboard Modal */}
      {showVirtualKeyboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <VirtualKeyboard
            title={`Enter ${label}`}
            value={value}
            onChange={onChange}
            onSubmit={() => {
              setShowVirtualKeyboard(false);
              onSubmit?.();
            }}
            onClose={() => setShowVirtualKeyboard(false)}
          />
        </div>
      )}
    </div>
  );
};
