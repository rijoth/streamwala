import React, { useEffect } from 'react';
import { pushBackHandler } from '../input/index.ts';
import { FocusZone } from '../focus/index.ts';
import { Icon } from '../icons/index.ts';

export interface SideSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: string;
  position?: 'right' | 'left';
  children: React.ReactNode;
}

export const SideSheet: React.FC<SideSheetProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  position = 'right',
  children,
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
    <div className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="flex-1"
        onClick={onClose}
      />
      <FocusZone
        isFocusBoundary={true}
        className={`
          w-full max-w-md h-full bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface)]
          border-l border-[var(--md-sys-color-outline-variant)] shadow-2xl p-6 flex flex-col gap-6
          ${position === 'left' ? 'order-first border-r border-l-0' : ''}
        `}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[var(--md-sys-color-outline-variant)]">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-10 h-10 rounded-xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center">
                <Icon name={icon} size={22} />
              </div>
            )}
            <h3 className="text-xl font-bold tracking-tight">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-outline)] cursor-pointer"
          >
            <Icon name="close" size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {children}
        </div>
      </FocusZone>
    </div>
  );
};
