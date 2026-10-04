import React, { useRef, useState } from 'react';
import { useFocusable } from '../focus/index.ts';
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
}) => {
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[var(--md-sys-color-on-surface-variant)]">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowVirtualKeyboard(true)}
          className="text-xs text-[var(--md-sys-color-primary)] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Icon name="keyboard" size={14} />
          <span>Remote Keyboard</span>
        </button>
      </div>

      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={`
          tv-focus-target relative flex items-center gap-3 px-4 py-3 rounded-2xl
          bg-[var(--md-sys-color-surface-container)] border transition-all duration-150
          ${error ? 'border-[var(--md-sys-color-error)]' : 'border-[var(--md-sys-color-outline-variant)]'}
          ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] !bg-[var(--md-sys-color-surface-container-high)]' : ''}
        `}
      >
        {icon && (
          <Icon name={icon} size={20} className="text-[var(--md-sys-color-on-surface-variant)] shrink-0" />
        )}
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSubmit) {
              onSubmit();
            }
          }}
          className="w-full bg-transparent text-[var(--md-sys-color-on-surface)] text-base outline-none placeholder:text-[var(--md-sys-color-outline)]"
        />
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
