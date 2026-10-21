import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Google Play listing guardrail.
 *
 * The store copy and graphics are published artifacts, and Play rejects them for
 * reasons that are invisible from the app: a 31st character in the title, an
 * 81st in the short description, an icon that is not 32-bit, a feature graphic
 * that carries alpha, a TV banner at the wrong size. Python is not available in
 * CI, so `scripts/play-assets.py` is never re-run as part of a check; the
 * committed PNGs are the contract. This suite is the drift guard for both.
 *
 * See docs/PLAY_STORE.md for the limits these assertions come from.
 */
const ROOT = process.cwd();
const METADATA = 'android/fastlane/metadata/android/en-US';
const IMAGES = `${METADATA}/images`;

const read = (relative: string) => readFileSync(path.join(ROOT, relative));
const text = (relative: string) => read(relative).toString('utf8');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface PngInfo {
  bytes: number;
  width: number;
  height: number;
  bitDepth: number;
  /** 2 = truecolour (24-bit), 6 = truecolour + alpha (32-bit). */
  colorType: number;
}

function pngInfo(relative: string): PngInfo {
  const file = read(relative);
  expect(file.subarray(0, 8).equals(PNG_SIGNATURE), `${relative} is not a PNG`).toBe(true);
  // IHDR is always the first chunk: 8-byte signature, 4-byte length, 4-byte
  // type, then width/height/bit depth/colour type.
  expect(file.subarray(12, 16).toString('ascii'), `${relative} has no IHDR first`).toBe('IHDR');
  return {
    bytes: file.length,
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
    bitDepth: file[24],
    colorType: file[25],
  };
}

const trimmed = (relative: string) => text(relative).trim();

describe('Play store listing copy', () => {
  it('title fits Play’s 30-character limit and is the product name', () => {
    const title = trimmed(`${METADATA}/title.txt`);
    expect(title).toBe('Streamwala IPTV Player');
    expect(title.length).toBeGreaterThan(0);
    expect(title.length, 'Play rejects a title over 30 characters').toBeLessThanOrEqual(30);
    expect(title).not.toMatch(/[\r\n]/);
  });

  it('gives the TV listing its own title instead of naming two apps the same', () => {
    const title = trimmed(`${METADATA}/title.tv.txt`);
    expect(title).toBe('Streamwala IPTV Player for TV');
    expect(title.length).toBeLessThanOrEqual(30);
    expect(title).not.toBe(trimmed(`${METADATA}/title.txt`));
  });

  it('short description fits Play’s 80-character limit and stays a single sentence group', () => {
    const short = trimmed(`${METADATA}/short_description.txt`);
    expect(short.length).toBeGreaterThan(0);
    expect(short.length, 'Play rejects a short description over 80 characters').toBeLessThanOrEqual(80);
    expect(short).not.toMatch(/[\r\n]/);
    expect(short).not.toMatch(/[!?]{2,}|\.\.\./);
  });

  it('full description fits Play’s 4000-character limit and uses no HTML', () => {
    const full = trimmed(`${METADATA}/full_description.txt`);
    expect(full.length).toBeGreaterThan(200);
    expect(full.length, 'Play rejects a description over 4000 characters').toBeLessThanOrEqual(4000);
    // Play renders limited HTML, but nothing in this copy needs it and a stray
    // tag is an easy way to ship an unclosed element into the store.
    expect(full).not.toMatch(/<[a-z!/][^>]*>/i);
  });

  it('store copy avoids the marketing language Play’s metadata policy bans', () => {
    const copy = [
      trimmed(`${METADATA}/title.txt`),
      trimmed(`${METADATA}/title.tv.txt`),
      trimmed(`${METADATA}/short_description.txt`),
      trimmed(`${METADATA}/full_description.txt`),
    ].join('\n');
    const banned = [/#1\b/i, /\bbest\b/i, /\btop\b/i, /download now/i, /install now/i, /play now/i, /\baward\b/i];
    for (const pattern of banned) {
      expect(copy, `store copy matches banned phrase ${pattern}`).not.toMatch(pattern);
    }
  });

  it('keeps the "ships no channels" position that the IPTV policy review turns on', () => {
    const full = trimmed(`${METADATA}/full_description.txt`);
    expect(full).toMatch(/ships no channels/i);
    expect(full).toMatch(/responsible for having the right to watch/i);
  });
});

describe('Play store graphics', () => {
  it('app icon is 512x512, 32-bit RGBA and under 1024 KB', () => {
    const icon = pngInfo(`${IMAGES}/icon.png`);
    expect(icon.width).toBe(512);
    expect(icon.height).toBe(512);
    expect(icon.bitDepth).toBe(8);
    expect(icon.colorType, 'Play requires a 32-bit PNG with alpha').toBe(6);
    expect(icon.bytes).toBeLessThanOrEqual(1024 * 1024);
  });

  it('feature graphic is 1024x500 and 24-bit with no alpha', () => {
    const graphic = pngInfo(`${IMAGES}/featureGraphic.png`);
    expect(graphic.width).toBe(1024);
    expect(graphic.height).toBe(500);
    expect(graphic.bitDepth).toBe(8);
    expect(graphic.colorType, 'Play requires a 24-bit PNG without alpha').toBe(2);
  });

  it('TV banner is 1280x720 and 24-bit with no alpha', () => {
    const banner = pngInfo(`${IMAGES}/tvBanner.png`);
    expect(banner.width).toBe(1280);
    expect(banner.height).toBe(720);
    expect(banner.bitDepth).toBe(8);
    expect(banner.colorType, 'a TV banner is a 24-bit image').toBe(2);
  });

  it('keeps a home for screenshots, which Play cannot take for us', () => {
    for (const folder of ['tenInchScreenshots', 'tvScreenshots']) {
      expect(
        statSync(path.join(ROOT, IMAGES, folder)).isDirectory(),
        `${IMAGES}/${folder} must exist so scripts/play-screenshots.sh has a target`,
      ).toBe(true);
    }
  });
});

describe('Play publishing tooling and policy', () => {
  it('ships an upload script for both packages', () => {
    const script = read('scripts/play-upload.sh').toString('utf8');
    expect(script).toContain('tv.streamwala.iptv');
    expect(script).toContain('tv.streamwala.iptv.tv');
    // The keystore check is what stops an unsigned AAB reaching Play.
    expect(script).toContain('keystore.properties');
  });

  it('publishes a privacy policy that matches what the app actually does', () => {
    const policy = text('docs/PRIVACY.md');
    expect(policy).toMatch(/Last updated:/);
    expect(policy).toMatch(/no analytics/i);
    expect(policy).toMatch(/IndexedDB/);
    expect(policy).toMatch(/does not sell/i);
    // The policy must not promise encryption the player does not guarantee:
    // IPTV endpoints are routinely cleartext and the shell permits them.
    expect(policy).toMatch(/cleartext|not\s+encrypted/i);
  });

  it('documents the console-side declarations no file can fill in', () => {
    const doc = text('docs/PLAY_STORE.md');
    for (const required of ['Data safety', 'Content rating', 'TV', 'privacy policy']) {
      expect(doc.toLowerCase()).toContain(required.toLowerCase());
    }
  });
});
