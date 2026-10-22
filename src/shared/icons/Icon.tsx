import React from 'react';
import * as LucideIcons from 'lucide-react';
import { ICON_FONT_GLYPHS, STATIC_GLYPHS } from './glyphPaths.generated.ts';

/**
 * Icon names the shipped webfont actually contains (ADR 036). Anything else
 * must fall back to a real glyph: an unknown name renders as the literal words
 * it is spelled with, because Material Symbols is a ligature font.
 */
const KNOWN_GLYPHS = new Set(ICON_FONT_GLYPHS);

export interface IconProps {
  name: string;
  filled?: boolean;
  /** Design px (24 = 1.5rem) or any CSS length such as `var(--rail-icon-size)`. */
  size?: number | string;
  className?: string;
  weight?: number;
}

/**
 * Numeric sizes are design px: 16 design px === 1rem, so every icon call site
 * that passes a number follows the root font-size (and therefore `--u`) with
 * no per-site churn. A string is passed through so token-driven sizes keep
 * working.
 */
function cssLength(size: number | string): string {
  return typeof size === 'number' ? `${size / 16}rem` : size;
}

/**
 * Material Symbols Rounded icon wrapper with Lucide fallback.
 * Strictly adheres to 10-foot legibility standards.
 *
 * Icons named in `STATIC_GLYPHS` render as inline SVG instead of a ligature in
 * the icon font (ADR 036). Material Symbols is a *ligature* font: the DOM holds
 * the literal words `live_tv`, so any font that has not loaded yet paints
 * those words — which is what the brand-scale marks used to do for seconds on
 * a cold TV start. The outlines there are generated from the same font by
 * `scripts/build-fonts.py`, so the shapes are identical.
 */
export const Icon: React.FC<IconProps> = ({
  name,
  filled = false,
  size = '1.5rem',
  className = '',
  weight = 400,
}) => {
  // Brand-scale marks never wait on a webfont: the outline ships in the bundle.
  const staticGlyph = STATIC_GLYPHS[name];
  if (staticGlyph) {
    const edge = cssLength(size);
    return (
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox={staticGlyph.viewBox}
        fill="currentColor"
        className={`glyph-mark select-none inline-block shrink-0 ${filled ? 'filled' : ''} ${className}`}
        style={{ width: edge, height: edge }}
      >
        <path d={filled ? staticGlyph.filledPath : staticGlyph.path} />
      </svg>
    );
  }

  // If the icon is standard Material Symbol (lowercase with underscores or hyphens)
  const isMaterialSymbol = KNOWN_GLYPHS.has(name);

  if (isMaterialSymbol) {
    const style: React.CSSProperties = {
      fontSize: cssLength(size),
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
    return <LucideComponent size={cssLength(size)} className={className} />;
  }

  return (
    <span
      aria-hidden="true"
      className={`material-symbols-rounded select-none inline-flex items-center justify-center ${className}`}
      style={{ fontSize: cssLength(size) }}
    >
      {/* The ligature name must exist in the subsetted font, or the fallback
          itself renders as words. The `_outline` variants are gone upstream;
          FILL 0 is the outline (see scripts/build-fonts.py). */}
      help
    </span>
  );
};
