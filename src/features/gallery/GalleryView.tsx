import React, { useState } from 'react';
import { FocusZone } from '../../shared/focus/index.ts';
import { Button, Card, Chip, Dialog, SideSheet, TextField, VirtualKeyboard, LinearProgress, CircularProgress } from '../../shared/ui/index.ts';
import { Icon } from '../../shared/icons/index.ts';

export const GalleryView: React.FC = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [showSideSheet, setShowSideSheet] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [textValue, setTextValue] = useState('https://iptv.example.com/playlist.m3u8');
  const [chipSelected, setChipSelected] = useState(true);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-8 text-[var(--md-sys-color-on-surface)] space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Material Design 3 Component Gallery</h1>
        <p className="text-sm text-[var(--md-sys-color-outline)] mt-1">
          Leanback TV Remote (D-Pad) focus test harness for all design system primitives.
        </p>
      </div>

      {/* Buttons */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold border-b border-[var(--md-sys-color-outline-variant)] pb-2">Buttons</h2>
        <FocusZone focusKey="GALLERY_BUTTONS" className="flex flex-wrap items-center gap-4">
          <Button variant="filled" icon="play_arrow" autoFocus onClick={() => alert('Filled button activated')}>
            Filled Button
          </Button>
          <Button variant="tonal" icon="favorite" onClick={() => alert('Tonal button activated')}>
            Tonal Button
          </Button>
          <Button variant="outlined" icon="settings" onClick={() => alert('Outlined button activated')}>
            Outlined Button
          </Button>
          <Button variant="text" icon="help" onClick={() => alert('Text button activated')}>
            Text Button
          </Button>
          <Button variant="filled" disabled icon="block">
            Disabled
          </Button>
        </FocusZone>
      </section>

      {/* Chips */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold border-b border-[var(--md-sys-color-outline-variant)] pb-2">Filter & Assist Chips</h2>
        <FocusZone focusKey="GALLERY_CHIPS" className="flex flex-wrap items-center gap-3">
          <Chip
            label="Selected Chip"
            selected={chipSelected}
            icon="check"
            badge="42"
            onClick={() => setChipSelected(!chipSelected)}
          />
          <Chip
            label="Unselected Chip"
            selected={!chipSelected}
            icon="star"
            onClick={() => setChipSelected(!chipSelected)}
          />
          <Chip label="Sports Channels" badge="12" icon="sports_soccer" />
          <Chip label="Documentaries" badge="8" icon="movie" />
        </FocusZone>
      </section>

      {/* Cards */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold border-b border-[var(--md-sys-color-outline-variant)] pb-2">Cards</h2>
        <FocusZone focusKey="GALLERY_CARDS" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="filled" className="p-6" onClick={() => alert('Filled card clicked')}>
            <h3 className="font-bold text-lg mb-1">Filled Card</h3>
            <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
              Container surface with subtle contrast and remote focus elevation.
            </p>
          </Card>

          <Card variant="elevated" className="p-6" onClick={() => alert('Elevated card clicked')}>
            <h3 className="font-bold text-lg mb-1">Elevated Card</h3>
            <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
              Tonal elevation with drop shadow for primary viewport anchors.
            </p>
          </Card>

          <Card variant="outlined" className="p-6" onClick={() => alert('Outlined card clicked')}>
            <h3 className="font-bold text-lg mb-1">Outlined Card</h3>
            <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
              Hairline border without surface fill for secondary content.
            </p>
          </Card>
        </FocusZone>
      </section>

      {/* Text Field & Virtual Keyboard */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold border-b border-[var(--md-sys-color-outline-variant)] pb-2">10-Foot Text Inputs & Keyboard</h2>
        <div className="max-w-xl">
          <TextField
            label="IPTV Stream URL"
            value={textValue}
            onChange={setTextValue}
            icon="link"
            hint="Press Enter to edit with Android TV keyboard or click remote keyboard icon"
          />
        </div>
      </section>

      {/* Overlays & Modals */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold border-b border-[var(--md-sys-color-outline-variant)] pb-2">Overlays & Dialogs</h2>
        <FocusZone focusKey="GALLERY_OVERLAYS" className="flex items-center gap-4">
          <Button variant="tonal" icon="open_in_new" onClick={() => setShowDialog(true)}>
            Open Dialog Modal
          </Button>
          <Button variant="tonal" icon="dock_to_right" onClick={() => setShowSideSheet(true)}>
            Open Side Sheet
          </Button>
          <Button variant="tonal" icon="keyboard" onClick={() => setShowKeyboard(true)}>
            Open Fullscreen Virtual Keyboard
          </Button>
        </FocusZone>
      </section>

      {/* Progress Indicators */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold border-b border-[var(--md-sys-color-outline-variant)] pb-2">Progress Indicators</h2>
        <div className="flex items-center gap-8 max-w-xl">
          <CircularProgress size={36} />
          <div className="flex-1 space-y-2">
            <LinearProgress value={65} />
            <LinearProgress />
          </div>
        </div>
      </section>

      {/* Dialog */}
      <Dialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        title="10-Foot Modal Dialog"
        icon="info"
      >
        <p className="mb-4">
          This dialog automatically traps D-pad focus and listens for the remote BACK button (Escape / Keycode 4) to dismiss cleanly.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="tonal" onClick={() => setShowDialog(false)}>
            Cancel
          </Button>
          <Button variant="filled" autoFocus onClick={() => setShowDialog(false)}>
            Confirm
          </Button>
        </div>
      </Dialog>

      {/* Side Sheet */}
      <SideSheet
        isOpen={showSideSheet}
        onClose={() => setShowSideSheet(false)}
        title="Channel Details Sheet"
        icon="tv"
      >
        <div className="space-y-4 text-sm">
          <p>
            Side sheets slide in from the right to present rich EPG metadata and program schedules while keeping context intact.
          </p>
          <Button variant="filled" icon="check" autoFocus onClick={() => setShowSideSheet(false)}>
            Close Sheet
          </Button>
        </div>
      </SideSheet>

      {/* Virtual Keyboard */}
      {showKeyboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/85 backdrop-blur-md">
          <VirtualKeyboard
            value={textValue}
            onChange={setTextValue}
            onSubmit={() => setShowKeyboard(false)}
            onClose={() => setShowKeyboard(false)}
          />
        </div>
      )}
    </div>
  );
};
