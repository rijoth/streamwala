export type SemanticKeyAction =
  | 'NAV_UP'
  | 'NAV_DOWN'
  | 'NAV_LEFT'
  | 'NAV_RIGHT'
  | 'SELECT'
  | 'BACK'
  | 'PLAY_PAUSE'
  | 'PLAY'
  | 'PAUSE'
  | 'STOP'
  | 'FF'
  | 'REWIND'
  | 'CH_UP'
  | 'CH_DOWN'
  | 'MENU'
  | 'INFO'
  | 'COLOR_RED'
  | 'COLOR_GREEN'
  | 'COLOR_YELLOW'
  | 'COLOR_BLUE'
  | 'DIGIT';

export interface NormalizedKeyEvent {
  action: SemanticKeyAction;
  rawKey: string;
  keyCode: number;
  digit?: number;
  isLongPress?: boolean;
}

/**
 * Normalizes keyboard and smart TV remote control events.
 */
export function normalizeKeyEvent(e: KeyboardEvent): NormalizedKeyEvent | null {
  const code = e.keyCode || e.which;
  const key = e.key;

  // Digits (0 - 9)
  if ((code >= 48 && code <= 57) || (code >= 96 && code <= 105)) {
    const digit = code >= 96 ? code - 96 : code - 48;
    return { action: 'DIGIT', rawKey: key, keyCode: code, digit };
  }

  // D-Pad Navigation
  if (key === 'ArrowUp' || code === 38 || code === 19) {
    return { action: 'NAV_UP', rawKey: key, keyCode: code };
  }
  if (key === 'ArrowDown' || code === 40 || code === 20) {
    return { action: 'NAV_DOWN', rawKey: key, keyCode: code };
  }
  if (key === 'ArrowLeft' || code === 37 || code === 21) {
    return { action: 'NAV_LEFT', rawKey: key, keyCode: code };
  }
  if (key === 'ArrowRight' || code === 39 || code === 22) {
    return { action: 'NAV_RIGHT', rawKey: key, keyCode: code };
  }

  // Select / OK / Enter
  if (key === 'Enter' || code === 13 || code === 23 || key === 'Select' || key === 'NumpadEnter') {
    return { action: 'SELECT', rawKey: key, keyCode: code };
  }

  // Back / Escape / Android Back / Tizen Return / webOS Back
  if (
    key === 'Escape' ||
    code === 27 ||
    code === 4 ||       // Android KEYCODE_BACK
    code === 10009 ||   // Tizen Return
    code === 461 ||     // webOS Back
    key === 'BrowserBack'
  ) {
    return { action: 'BACK', rawKey: key, keyCode: code };
  }

  // Media Controls
  if (key === 'MediaPlayPause' || code === 179 || key === 'k') {
    return { action: 'PLAY_PAUSE', rawKey: key, keyCode: code };
  }
  if (key === 'MediaPlay' || code === 415) {
    return { action: 'PLAY', rawKey: key, keyCode: code };
  }
  if (key === 'MediaPause' || code === 19) {
    return { action: 'PAUSE', rawKey: key, keyCode: code };
  }
  if (key === 'MediaStop' || code === 413) {
    return { action: 'STOP', rawKey: key, keyCode: code };
  }
  if (key === 'MediaFastForward' || code === 417 || key === 'MediaTrackNext' || key === 'l') {
    return { action: 'FF', rawKey: key, keyCode: code };
  }
  if (key === 'MediaRewind' || code === 412 || key === 'MediaTrackPrevious' || key === 'j') {
    return { action: 'REWIND', rawKey: key, keyCode: code };
  }

  // Channel Up / Down
  if (key === 'ChannelUp' || code === 427 || key === 'PageUp' || code === 33) {
    return { action: 'CH_UP', rawKey: key, keyCode: code };
  }
  if (key === 'ChannelDown' || code === 428 || key === 'PageDown' || code === 34) {
    return { action: 'CH_DOWN', rawKey: key, keyCode: code };
  }

  // Info / Menu
  if (key === 'ContextMenu' || code === 93 || code === 82 || key === 'Info' || code === 457 || key === 'i' || key === 'm') {
    return { action: 'INFO', rawKey: key, keyCode: code };
  }

  // Smart TV Colored Function Keys
  if (code === 403 || key === 'Red' || key === 'ColorF0Red') {
    return { action: 'COLOR_RED', rawKey: key, keyCode: code };
  }
  if (code === 404 || key === 'Green' || key === 'ColorF1Green') {
    return { action: 'COLOR_GREEN', rawKey: key, keyCode: code };
  }
  if (code === 405 || key === 'Yellow' || key === 'ColorF2Yellow') {
    return { action: 'COLOR_YELLOW', rawKey: key, keyCode: code };
  }
  if (code === 406 || key === 'Blue' || key === 'ColorF3Blue') {
    return { action: 'COLOR_BLUE', rawKey: key, keyCode: code };
  }

  return null;
}
