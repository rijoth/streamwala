import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon.tsx';
import { STATIC_GLYPHS } from './glyphPaths.generated.ts';

/**
 * `Icon` has two render paths (ADR 036): generated inline SVG for the marks
 * that must never wait on a webfont, and the Material Symbols ligature for
 * everything else. jsdom cannot shape text, so these assertions are about
 * *which* path ran and what was put in the DOM — the geometry proof lives in
 * `e2e/fonts.spec.ts`.
 */
describe('Icon', () => {
  it('renders finite svg glyphs for the brand-scale marks instead of ligature text', () => {
    const { container } = render(<Icon name="live_tv" size={56} />);

    const svg = container.querySelector('svg.glyph-mark') as SVGElement | null;
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('viewBox')).toBe(STATIC_GLYPHS.live_tv.viewBox);
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
    // Sized from the design-px scale: 56 / 16 === 3.5rem.
    expect(svg!.style.width).toBe('3.5rem');
    expect(svg!.style.height).toBe('3.5rem');

    const path = svg!.querySelector('path')!.getAttribute('d')!;
    expect(path.startsWith('M')).toBe(true);
    expect(path.length).toBeGreaterThan(40);

    // No webfont span, and nothing that could paint as the literal word.
    expect(container.querySelector('.material-symbols-rounded')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('switches to the filled outline without touching the font', () => {
    const { container, rerender } = render(<Icon name="live_tv" size={140} />);
    const unfilled = container.querySelector('path')!.getAttribute('d');

    rerender(<Icon name="live_tv" size={140} filled />);
    const filled = container.querySelector('path')!.getAttribute('d');

    expect(filled).not.toBe(unfilled);
    expect(filled).toBe(STATIC_GLYPHS.live_tv.filledPath);
  });

  it('accepts token-driven sizes on the svg path', () => {
    const { container } = render(<Icon name="live_tv" size="var(--rail-icon-size)" />);
    const svg = container.querySelector('svg.glyph-mark') as SVGElement;
    expect(svg.style.width).toBe('var(--rail-icon-size)');
  });

  it('keeps using the ligature font for ordinary icons', () => {
    const { container } = render(<Icon name="arrow_forward" size={24} />);

    const span = container.querySelector('.material-symbols-rounded');
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe('arrow_forward');
    expect(span!.getAttribute('aria-hidden')).toBe('true');
  });

  it('falls back to a ligature name the font actually contains', () => {
    const { container } = render(<Icon name="not_a_real_icon_name" />);

    // Unknown names must not leak the requested word onto the screen; the
    // fallback has to be a glyph that exists in the subset.
    const span = container.querySelector('.material-symbols-rounded');
    expect(span!.textContent?.trim()).toBe('help');
  });
});
