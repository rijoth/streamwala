import React from 'react';
import { Icon } from '../icons/index.ts';

export interface ToastMessage {
  id: string;
  type?: 'info' | 'success' | 'error' | 'warning';
  title: string;
  message?: string;
}

export interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-3 max-w-sm pointer-events-auto">
      {toasts.map((toast) => {
        let icon = 'info';
        let colorClasses = 'border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)]';
        if (toast.type === 'success') {
          icon = 'check_circle';
          colorClasses = 'border-emerald-600 bg-[var(--md-sys-color-surface-container-high)] text-emerald-300';
        } else if (toast.type === 'error') {
          icon = 'error';
          colorClasses = 'border-[var(--md-sys-color-error)] bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-error)]';
        } else if (toast.type === 'warning') {
          icon = 'warning';
          colorClasses = 'border-amber-500 bg-[var(--md-sys-color-surface-container-high)] text-amber-300';
        }

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-2xl border shadow-2xl animate-fade-in ${colorClasses}`}
          >
            <Icon name={icon} size={22} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-[var(--md-sys-color-on-surface)]">{toast.title}</h4>
              {toast.message && (
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-0.5">{toast.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-[var(--md-sys-color-outline)] hover:text-[var(--md-sys-color-on-surface)]"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
