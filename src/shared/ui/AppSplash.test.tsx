import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppSplash } from './AppSplash.tsx';
import { PRODUCT_COPYRIGHT, PRODUCT_REPOSITORY_LABEL } from '../product.ts';

/**
 * The splash is one of three renders of the same generated mark (native splash,
 * static copy in index.html, this component), so the contract that matters is
 * that it is the mark, it is announced, and it says who made it.
 *
 * The credit is asserted against `shared/product` rather than against a literal
 * so the splash cannot drift from the shell footer and Settings → About.
 */
describe('AppSplash', () => {
  it('renders the generated mark, the product name and the two-line credit', () => {
    render(<AppSplash />);

    const splash = screen.getByTestId('app-splash');
    expect(splash).toBeInTheDocument();

    const mark = splash.querySelector('img');
    expect(mark).not.toBeNull();
    expect(mark).toHaveAttribute('alt', '');
    expect(mark?.getAttribute('src')).toMatch(/svg/);

    expect(screen.getByText('Streamwala')).toBeInTheDocument();

    const credit = screen.getByTestId('app-splash-credit');
    const lines = credit.querySelectorAll('span');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent(PRODUCT_COPYRIGHT);
    expect(lines[1]).toHaveTextContent(PRODUCT_REPOSITORY_LABEL);
  });

  it('renders the credit as inert plain text, never a link', () => {
    render(<AppSplash />);

    const credit = screen.getByTestId('app-splash-credit');
    expect(credit.querySelector('a')).toBeNull();
    expect(credit).not.toHaveAttribute('href');
    expect(credit).not.toHaveAttribute('tabindex');
    expect(credit.className).toContain('pointer-events-none');
    // The old subtitle's muted secondary colour, and no bold weight.
    expect(credit.className).toContain('text-[var(--md-sys-color-on-surface-variant)]');
    expect(credit.className).toContain('font-normal');
  });

  it('is announced as a status region while it is on screen', () => {
    render(<AppSplash />);

    const splash = screen.getByTestId('app-splash');
    expect(splash).toHaveAttribute('role', 'status');
    expect(splash).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading Streamwala')).toBeInTheDocument();
  });

  it('drops to transparent and stops taking pointer events once it is leaving', () => {
    render(<AppSplash leaving />);

    const splash = screen.getByTestId('app-splash');
    expect(splash).toHaveClass('opacity-0');
    expect(splash).toHaveClass('pointer-events-none');
    expect(splash).toHaveAttribute('aria-busy', 'false');
  });

  it('has no focusable content, so the D-pad cannot land on the boot screen', () => {
    render(<AppSplash />);

    const splash = screen.getByTestId('app-splash');
    expect(splash.querySelectorAll('button, a, input, [tabindex]')).toHaveLength(0);
  });
});
