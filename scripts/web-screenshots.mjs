#!/usr/bin/env node
/**
 * Capture the web build at a chosen viewport (phone / tablet / desktop) into
 * docs/screenshots/.
 *
 *   node scripts/web-screenshots.mjs phone # 390x844 @2x  -> docs/screenshots/phone/
 *   node scripts/web-screenshots.mjs tablet --base-url http://localhost:3000
 *
 * The Play listing screenshots come from a real device (scripts/play-screenshots.sh);
 * this script is for the repository docs and for looking at the shell at small
 * widths, where no layout breakpoint exists yet. It drives the demo playlist so
 * no provider URL, username or channel from a private account can leak into a
 * committed image.
 *
 * Same honesty rules as the Play captures: no device frames, no mockups, no
 * post-processing beyond the lossless PNG the browser produced.
 */

import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(import.meta.dirname, '..');

/** Named viewports. `dpr` 2 keeps the PNG legible when scaled down in Markdown. */
const PRESETS = {
  phone: { width: 390, height: 844, dpr: 2 },
  'phone-landscape': { width: 844, height: 390, dpr: 2 },
  // The narrowest layout the tablet APK is distributed to: sw600dp portrait.
  'tablet-portrait': { width: 600, height: 960, dpr: 2 },
  tablet: { width: 1024, height: 768, dpr: 2 },
  tv: { width: 1920, height: 1080, dpr: 1 },
};

function parseArgs(argv) {
  const args = { preset: 'phone', baseUrl: 'http://localhost:3000', keep: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base-url') args.baseUrl = argv[++i];
    else if (arg === '--keep') args.keep = true;
    else if (arg === '--help' || arg === '-h') args.preset = null;
    else if (arg.startsWith('-')) throw new Error(`unknown flag ${arg}`);
    else args.preset = arg;
  }
  return args;
}

async function reachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await reachable(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`dev server never answered at ${url}`);
}

/** Start `npm run dev` only when nothing is already listening. */
async function ensureServer(baseUrl) {
  if (await reachable(baseUrl)) return { stop: async () => {} };

  const child = spawn('npm', ['run', 'dev'], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
    detached: true,
  });
  try {
    await waitForServer(baseUrl);
  } catch (error) {
    process.kill(-child.pid, 'SIGTERM');
    throw error;
  }
  return {
    stop: async () => {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        // Already gone.
      }
    },
  };
}

async function settle(page) {
  // Splash holds for a minimum display time (ADR 022); fonts and images follow.
  await page.locator('[data-testid="app-splash"]').waitFor({ state: 'detached', timeout: 30_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images)
        .filter((image) => !image.complete)
        .map((image) => new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        }))
    );
  });
  // One extra frame so the last layout pass is painted.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
}

async function capture(page, outDir, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, animations: 'disabled' });
  process.stdout.write(`  ${path.relative(ROOT, file)}\n`);
}

const RAIL = '[data-testid="navigation-rail"]';

async function openDemoHome(page) {
  await page.goto('/');
  await settle(page);
  await page.getByRole('button', { name: /Get Started/i }).click();
  // Click the demo source directly: this script is not a D-pad test, so it must
  // not depend on a grid geometry that changes with the viewport width.
  await page.getByText('Legal Public Test Streams').click();
  await page.getByText('Featured Live').waitFor({ timeout: 30_000 });
  await settle(page);
}

async function goTo(page, label) {
  await page.locator(RAIL).getByRole('button', { name: label, exact: true }).click();
  await settle(page);
  await page.waitForTimeout(400); // let async screens (EPG) settle their focus
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.preset) {
    process.stdout.write(
      `usage: node scripts/web-screenshots.mjs [${Object.keys(PRESETS).join('|')}] ` +
        '[--base-url URL] [--keep]\n'
    );
    return;
  }
  const preset = PRESETS[args.preset];
  if (!preset) throw new Error(`unknown viewport "${args.preset}" (known: ${Object.keys(PRESETS)})`);

  const outDir = path.join(ROOT, 'docs', 'screenshots', args.preset);
  if (!args.keep) await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const server = await ensureServer(args.baseUrl);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: preset.width, height: preset.height },
      deviceScaleFactor: preset.dpr,
      reducedMotion: 'reduce',
      colorScheme: 'dark',
      baseURL: args.baseUrl,
    });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') process.stdout.write(`  console: ${message.text()}\n`);
    });

    process.stdout.write(`${args.preset} ${preset.width}x${preset.height} @${preset.dpr}x\n`);

    // 1. First-run onboarding, before any playlist exists.
    await page.goto('/');
    await settle(page);
    await capture(page, outDir, '01-onboarding');

    await page.getByRole('button', { name: /Get Started/i }).click();
    await settle(page);
    await capture(page, outDir, '02-playlist-source');

    // 2. Demo import -> the shell.
    await page.getByText('Legal Public Test Streams').click();
    await page.getByText('Featured Live').waitFor({ timeout: 30_000 });
    await settle(page);
    await capture(page, outDir, '03-home');

    await goTo(page, 'Live TV');
    await capture(page, outDir, '04-live-tv');

    await goTo(page, 'EPG Guide');
    await capture(page, outDir, '05-guide');

    await goTo(page, 'Favorites');
    await capture(page, outDir, '06-favorites');

    await goTo(page, 'Settings');
    await capture(page, outDir, '07-settings');

    await context.close();
  } finally {
    await browser.close();
    await server.stop();
  }
}

main().catch((error) => {
  process.stderr.write(`web-screenshots: ${error.message}\n`);
  process.exitCode = 1;
});
