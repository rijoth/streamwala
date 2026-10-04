import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  isNative: true,
  backButtonHandler: null as null | (() => void),
  exitApp: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => hoisted.isNative },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (event: string, callback: () => void) => {
      if (event === 'backButton') hoisted.backButtonHandler = callback;
      return Promise.resolve({ remove: vi.fn() });
    },
    exitApp: hoisted.exitApp,
  },
}));

async function loadModules() {
  vi.resetModules();
  hoisted.backButtonHandler = null;
  return {
    bridge: await import('./nativeBackBridge.ts'),
    input: await import('./useTvInput.ts'),
  };
}

describe('native BACK bridge', () => {
  beforeEach(() => {
    hoisted.isNative = true;
    hoisted.exitApp.mockClear();
  });

  it('does not register a listener on the web build', async () => {
    hoisted.isNative = false;
    const { bridge } = await loadModules();

    bridge.initNativeBackBridge();

    expect(hoisted.backButtonHandler).toBeNull();
  });

  it('routes the hardware BACK press through the shared BACK stack', async () => {
    const { bridge, input } = await loadModules();
    bridge.initNativeBackBridge();

    const overlayClose = vi.fn(() => true);
    input.pushBackHandler(overlayClose);

    hoisted.backButtonHandler?.();

    expect(overlayClose).toHaveBeenCalledTimes(1);
    expect(hoisted.exitApp).not.toHaveBeenCalled();
  });

  it('exits the app when no overlay consumed the press', async () => {
    const { bridge } = await loadModules();
    bridge.initNativeBackBridge();

    hoisted.backButtonHandler?.();

    expect(hoisted.exitApp).toHaveBeenCalledTimes(1);
  });

  it('pops exactly one layer per physical press', async () => {
    const { bridge, input } = await loadModules();
    bridge.initNativeBackBridge();

    const inner = vi.fn(() => true);
    const outer = vi.fn(() => true);
    input.pushBackHandler(outer);
    input.pushBackHandler(inner);

    hoisted.backButtonHandler?.();
    hoisted.backButtonHandler?.();

    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).toHaveBeenCalledTimes(1);
    expect(hoisted.exitApp).not.toHaveBeenCalled();
  });
});
