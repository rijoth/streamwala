import React from 'react';
import * as LucideIcons from 'lucide-react';

export interface IconProps {
  name: string;
  filled?: boolean;
  size?: number | string;
  className?: string;
  weight?: number;
}

/**
 * Material Symbols Rounded icon wrapper with Lucide fallback.
 * Strictly adheres to 10-foot legibility standards.
 */
export const Icon: React.FC<IconProps> = ({
  name,
  filled = false,
  size = 24,
  className = '',
  weight = 400,
}) => {
  // If the icon is standard Material Symbol (lowercase with underscores or hyphens)
  const isMaterialSymbol = /^[a-z0-9_]+$/.test(name);

  if (isMaterialSymbol) {
    const style: React.CSSProperties = {
      fontSize: typeof size === 'number' ? `${size}px` : size,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' 24`,
    };

    return (
      <span
        aria-hidden="true"
        className={`material-symbols-rounded select-none inline-flex items-center justify-center ${filled ? 'filled' : ''} ${className}`}
        style={style}
      >
        {name}
      </span>
    );
  }

  // Fallback to Lucide icon component if PascalCase name is provided (e.g. "Tv", "Play")
  const lucideMap = LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number | string; className?: string }>>;
  const LucideComponent = lucideMap[name];
  if (LucideComponent) {
    return <LucideComponent size={size} className={className} />;
  }

  return (
    <span
      aria-hidden="true"
      className={`material-symbols-rounded select-none inline-flex items-center justify-center ${className}`}
      style={{ fontSize: typeof size === 'number' ? `${size}px` : size }}
    >
      help_outline
    </span>
  );
};
