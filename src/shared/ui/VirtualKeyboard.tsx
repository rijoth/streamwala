import React, { useState } from 'react';
import { FocusZone, useFocusable } from '../focus/index.ts';
import { Icon } from '../icons/index.ts';

export interface VirtualKeyboardProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onClose?: () => void;
  title?: string;
}

const URL_SHORTCUTS = ['http://', 'https://', '.com', '.m3u', '.m3u8', ':', '/', '.', '-', '_'];

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  value,
  onChange,
  onSubmit,
  onClose,
  title = 'On-Screen Remote Keyboard',
}) => {
  const [isShift, setIsShift] = useState(false);

  const rows = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '@'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '/', ':', '.'],
  ];

  const handleKeyPress = (char: string) => {
    onChange(value + (isShift ? char.toUpperCase() : char));
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange('');
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) onChange(value + text);
    } catch {
      // Clipboard read blocked
    }
  };

  return (
    <FocusZone className="w-full max-w-4xl bg-[var(--md-sys-color-surface-container-high)] rounded-3xl p-6 border border-[var(--md-sys-color-outline-variant)] shadow-2xl flex flex-col gap-4">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--md-sys-color-outline-variant)]">
        <div className="flex items-center gap-2">
          <Icon name="keyboard" size={24} className="text-[var(--md-sys-color-primary)]" />
          <span className="text-lg font-semibold text-[var(--md-sys-color-on-surface)]">{title}</span>
        </div>
        {onClose && (
          <KeyButton
            label="Close"
            icon="close"
            onClick={onClose}
            className="!px-3 !py-1 text-sm bg-transparent hover:bg-[var(--md-sys-color-surface-container)]"
          />
        )}
      </div>

      {/* Text preview display */}
      <div className="bg-[var(--md-sys-color-surface-container-lowest)] p-4 rounded-xl font-mono text-lg text-[var(--md-sys-color-on-surface)] border border-[var(--md-sys-color-outline-variant)] overflow-x-auto whitespace-nowrap min-h-[58px] flex items-center">
        {value ? (
          <span>{value}</span>
        ) : (
          <span className="text-[var(--md-sys-color-outline)] italic">Enter URL or text with D-pad...</span>
        )}
      </div>

      {/* URL Fast Shortcuts Row */}
      <div className="flex flex-wrap gap-2">
        {URL_SHORTCUTS.map((shortcut) => (
          <KeyButton
            key={shortcut}
            label={shortcut}
            onClick={() => onChange(value + shortcut)}
            className="!px-3 !py-2 text-sm font-mono bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-primary-container)]"
          />
        ))}
        <KeyButton
          label="Paste"
          icon="content_paste"
          onClick={handlePaste}
          className="!px-3 !py-2 text-sm bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]"
        />
      </div>

      {/* QWERTY Rows */}
      <div className="flex flex-col gap-2">
        {rows.map((row, rIdx) => (
          <div key={rIdx} className="flex justify-center gap-2">
            {rIdx === 3 && (
              <KeyButton
                label={isShift ? 'CAPS' : 'shift'}
                icon="shift"
                onClick={() => setIsShift(!isShift)}
                className={`!px-4 !py-2.5 font-medium ${isShift ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]' : ''}`}
              />
            )}
            {row.map((char) => (
              <KeyButton
                key={char}
                label={isShift ? char.toUpperCase() : char}
                onClick={() => handleKeyPress(char)}
                className="w-12 h-12 text-lg font-mono flex items-center justify-center"
              />
            ))}
            {rIdx === 3 && (
              <KeyButton
                label="Del"
                icon="backspace"
                onClick={handleBackspace}
                className="!px-4 !py-2.5 text-red-300"
              />
            )}
          </div>
        ))}

        {/* Space, Clear, Done Action Row */}
        <div className="flex justify-center gap-3 mt-2">
          <KeyButton
            label="Clear All"
            icon="delete_sweep"
            onClick={handleClear}
            className="!px-5 !py-3 text-sm text-[var(--md-sys-color-error)]"
          />
          <KeyButton
            label="Space"
            onClick={() => handleKeyPress(' ')}
            className="flex-1 max-w-sm !py-3 font-medium"
          />
          <KeyButton
            label="Done / Submit"
            icon="check"
            onClick={onSubmit}
            className="!px-8 !py-3 bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-bold text-base shadow-lg"
          />
        </div>
      </div>
    </FocusZone>
  );
};

interface KeyButtonProps {
  label: string;
  icon?: string;
  onClick: () => void;
  className?: string;
}

const KeyButton: React.FC<KeyButtonProps> = ({ label, icon, onClick, className = '' }) => {
  const { ref, focused } = useFocusable({
    onEnterPress: onClick,
  });

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={onClick}
      className={`
        tv-focus-target rounded-xl bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface)]
        border border-[var(--md-sys-color-outline-variant)] select-none cursor-pointer flex items-center justify-center gap-1.5
        transition-all duration-100 outline-none
        ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] scale-110 !bg-[var(--md-sys-color-primary-container)] !text-[var(--md-sys-color-on-primary-container)] z-10' : ''}
        ${className}
      `}
    >
      {icon && <Icon name={icon} size={18} />}
      <span>{label}</span>
    </button>
  );
};
