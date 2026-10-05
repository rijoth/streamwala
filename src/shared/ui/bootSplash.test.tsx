import { readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { screen } from '@testing-library/react';
import { AppSplash } from './AppSplash.tsx';

/**
 * The static splash in `index.html` is only ever replaced because React's first
 * commit clears the container's existing children. That is the load-bearing
 * assumption of the whole pre-React splash (ADR 022): if it ever stops holding,
 * the static copy would stay on top of the app forever, and no other test would
 * notice. So the markup under test is parsed from the shipped `index.html`
 * rather than written out here.
 */
describe('pre-React boot splash handover', () => {
  const html = readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

  it('ships a splash inside #root, styled without the bundled stylesheet', () => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const root = parsed.querySelector('#root');

    expect(root?.querySelector('.boot-splash')).not.toBeNull();
    expect(root?.querySelector('svg')).not.toBeNull();
    // The stylesheet the app imports arrives with the module script, so the
    // pre-React splash must carry its own rules and surface colour.
    expect(parsed.querySelector('style')?.textContent).toContain('.boot-splash');
    expect(parsed.querySelector('style')?.textContent).toContain('--boot-surface');
  });

  it('is replaced by AppSplash on React’s first commit, leaving exactly one splash', async () => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const staticSplash = parsed.querySelector('#root .boot-splash')!;

    const container = document.createElement('div');
    container.innerHTML = staticSplash.outerHTML;
    document.body.appendChild(container);

    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(AppSplash));
    });

    expect(container.querySelector('.boot-splash')).toBeNull();
    expect(container.querySelectorAll('.boot-splash, [data-testid="app-splash"]')).toHaveLength(1);
    expect(screen.getByTestId('app-splash')).toBeInTheDocument();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
