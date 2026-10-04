import React from 'react';

export interface LinearProgressProps {
  value?: number; // 0 to 100, or undefined for indeterminate
  className?: string;
}

export const LinearProgress: React.FC<LinearProgressProps> = ({
  value,
  className = '',
}) => {
  const isIndeterminate = value === undefined || typeof value !== 'number' || Number.isNaN(value);
  const safeValue = !isIndeterminate ? Math.min(100, Math.max(0, value)) : 0;

  return (
    <div
      className={`relative w-full h-2 rounded-full overflow-hidden bg-[var(--md-sys-color-surface-container-highest)] ${className}`}
      role="progressbar"
      aria-valuenow={isIndeterminate ? undefined : safeValue}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {isIndeterminate ? (
        <div className="absolute inset-0 bg-[var(--md-sys-color-primary)] animate-[indeterminate_1.5s_infinite_linear] rounded-full w-1/3" />
      ) : (
        <div
          className="h-full bg-[var(--md-sys-color-primary)] transition-all duration-200 rounded-full"
          style={{ width: `${safeValue}%` }}
        />
      )}
    </div>
  );
};

export interface CircularProgressProps {
  size?: number;
  className?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  size = 40,
  className = '',
}) => {
  return (
    <div
      className={`inline-block animate-spin rounded-full border-3 border-[var(--md-sys-color-surface-container-highest)] border-t-[var(--md-sys-color-primary)] ${className}`}
      style={{ width: size, height: size }}
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};
