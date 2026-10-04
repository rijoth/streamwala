import React from 'react';
import type { Channel, Program } from '../../domain/types.ts';
import { Button, SideSheet } from '../../shared/ui/index.ts';

export interface ProgramDetailsSheetProps {
  isOpen: boolean;
  program: Program | null;
  channel: Channel | null;
  isFavorite: boolean;
  remindersEnabled: boolean;
  reminderSet: boolean;
  onClose: () => void;
  onWatch: () => void;
  onToggleFavorite: () => void;
  onToggleReminder: () => void;
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const ProgramDetailsSheet: React.FC<ProgramDetailsSheetProps> = ({
  isOpen,
  program,
  channel,
  isFavorite,
  remindersEnabled,
  reminderSet,
  onClose,
  onWatch,
  onToggleFavorite,
  onToggleReminder,
}) => {
  return (
    <SideSheet
      isOpen={isOpen}
      onClose={onClose}
      title={program?.title ?? 'Program information'}
      icon="info"
    >
      {program && channel && (
        <div className="flex flex-col gap-4 text-sm">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--md-sys-color-surface-container-high)]">
            {channel.logo && (
              <img src={channel.logo} alt={channel.name} className="w-10 h-10 object-contain rounded-lg" />
            )}
            <div>
              <h4 className="font-bold text-base">{channel.name}</h4>
              <p className="text-xs text-[var(--md-sys-color-outline)] font-mono">
                {formatTime(program.start)} – {formatTime(program.stop)}
              </p>
            </div>
          </div>

          {(program.category || program.rating) && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {program.category && (
                <span className="font-medium text-[var(--md-sys-color-primary)]">
                  {program.category}
                </span>
              )}
              {program.rating && (
                <span className="text-[var(--md-sys-color-outline)]">{program.rating}</span>
              )}
            </div>
          )}

          <p className="leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
            {program.description || 'No detailed synopsis available for this program.'}
          </p>

          <div className="flex flex-col gap-2 pt-2">
            <Button variant="filled" icon="play_arrow" onClick={onWatch} className="!py-3">
              Watch now
            </Button>
            <Button
              variant="tonal"
              icon="star"
              onClick={onToggleFavorite}
              className="!py-2.5"
            >
              {isFavorite ? 'Remove from favorites' : 'Favorite channel'}
            </Button>
            {remindersEnabled && (
              <Button
                variant="outlined"
                icon={reminderSet ? 'notifications_off' : 'notifications_active'}
                onClick={onToggleReminder}
                className="!py-2.5"
              >
                {reminderSet ? 'Cancel reminder' : 'Remind me'}
              </Button>
            )}
          </div>
        </div>
      )}
    </SideSheet>
  );
};
