import React, { useEffect } from 'react';
import { pushBackHandler } from '../input/index.ts';
import { FocusZone } from '../focus/index.ts';
import { Icon } from '../icons/index.ts';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
  className = '',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    return pushBackHandler(() => {
      onClose();
      return true;
    });
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
      <FocusZone
        isFocusBoundary={true}
        className={`
          relative w-full max-w-xl bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)]
          rounded-3xl p-8 border border-[var(--md-sys-color-outline-variant)] shadow-2xl overflow-hidden
          ${className}
        `}
      >
        <div className="flex items-center gap-3 mb-6">
          {icon && (
            <div className="w-12 h-12 rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center">
              <Icon name={icon} size={28} />
            </div>
          )}
          <h2 className="text-2xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)]">
            {title}
          </h2>
        </div>

        <div className="text-[var(--md-sys-color-on-surface-variant)] text-base mb-6">
          {children}
        </div>
      </FocusZone>
    </div>
  );
};
