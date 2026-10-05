import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppSplash } from './AppSplash.tsx';

/**
 * The splash is one of three renders of the same generated mark (native splash,
 * static copy in index.html, this component), so the contract that matters is
 * that it is the mark, it is announced, and it says who it is.
 */
describe('AppSplash', () => {
  it('renders the generated mark, the product name and the tagline', () => {
    render(<AppSplash />);

    const splash = screen.getByTestId('app-splash');
    expect(splash).toBeInTheDocument();

    const mark = splash.querySelector('img');
    expect(mark).not.toBeNull();
    expect(mark).toHaveAttribute('alt', '');
    expect(mark?.getAttribute('src')).toMatch(/svg/);

    expect(screen.getByText('Streamwala')).toBeInTheDocument();
    expect(screen.getByText('10-Foot TV Player')).toBeInTheDocument();
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
