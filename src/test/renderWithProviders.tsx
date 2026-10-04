import React from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initFocusEngine } from '../shared/focus/index.ts';
import { applyTheme } from '../app/settingsStore.ts';
import { DEFAULT_SETTINGS } from '../domain/types.ts';

export interface ProviderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Route entries for router-aware components (defaults to a single "/"). */
  initialEntries?: string[];
}

/**
 * Renders a component inside the providers the app relies on. The focus engine
 * is a module-level singleton, so it is initialised here and reused.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  { initialEntries = ['/'], ...options }: ProviderOptions = {}
): RenderResult {
  initFocusEngine();
  applyTheme(DEFAULT_SETTINGS);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );

  // initialEntries is accepted for API stability with memory-router tests.
  void initialEntries;

  return render(ui, { wrapper: Wrapper, ...options });
}