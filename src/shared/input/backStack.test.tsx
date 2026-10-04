import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders.tsx';
import { pressKey } from '../../test/remote.ts';
import { Dialog } from '../ui/Dialog.tsx';
import { SideSheet } from '../ui/SideSheet.tsx';

function Harness() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <div>
      <button data-testid="open-dialog" onClick={() => setDialogOpen(true)}>
        open dialog
      </button>
      <button data-testid="open-sheet" onClick={() => setSheetOpen(true)}>
        open sheet
      </button>
      <Dialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} title="Dialog Title">
        dialog body
      </Dialog>
      <SideSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="Sheet Title">
        sheet body
      </SideSheet>
    </div>
  );
}

describe('BACK stack ordering (BUG-002 regression)', () => {
  it('closes exactly the topmost layer per BACK press', () => {
    renderWithProviders(<Harness />);

    fireEvent.click(screen.getByTestId('open-dialog'));
    fireEvent.click(screen.getByTestId('open-sheet'));

    expect(screen.getByText('Dialog Title')).toBeInTheDocument();
    expect(screen.getByText('Sheet Title')).toBeInTheDocument();

    // One Back must close only the sheet; the old bug popped both.
    pressKey('Back');
    expect(screen.queryByText('Sheet Title')).not.toBeInTheDocument();
    expect(screen.getByText('Dialog Title')).toBeInTheDocument();

    pressKey('Back');
    expect(screen.queryByText('Dialog Title')).not.toBeInTheDocument();
  });

  it('does not intercept Escape while editing a text field', () => {
    renderWithProviders(<Harness />);
    fireEvent.click(screen.getByTestId('open-dialog'));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Backspace inside an input must edit text, not close the dialog.
    pressKey('Backspace', { target: input });
    expect(screen.getByText('Dialog Title')).toBeInTheDocument();

    input.remove();
  });
});