import React from 'react';
import { Icon } from '../../shared/icons/index.ts';

export interface NumberZapOverlayProps {
  digits: string;
  matchedChannelName?: string;
}

export const NumberZapOverlay: React.FC<NumberZapOverlayProps> = ({
  digits,
  matchedChannelName,
}) => {
  if (!digits) return null;

  return (
    <div className="fixed top-12 right-12 z-50 animate-fade-in pointer-events-none">
      <div className="bg-black/85 backdrop-blur-md px-6 py-4 rounded-3xl border-2 border-[var(--md-sys-color-primary)] shadow-2xl flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] flex items-center justify-center font-bold text-xl">
          <Icon name="dialpad" size={24} />
        </div>
        <div>
          <div className="text-3xl font-black font-mono tracking-widest text-[var(--md-sys-color-primary)]">
            {digits}
          </div>
          {matchedChannelName && (
            <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] max-w-[200px] truncate">
              {matchedChannelName}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
