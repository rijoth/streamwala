import { describe, it, expect } from 'vitest';
import { EpgFetchError } from '../../../services/epg/fetcher.ts';
import { epgErrorMessage } from './useEpgManager.ts';

describe('epgErrorMessage (BUG-026)', () => {
  it('keeps EPG fetch copy verbatim, including CORS and mixed-content hints', () => {
    const cors = new EpgFetchError(
      'cors',
      'The EPG server (iptv-epg.org) blocked the browser request (CORS). Enable a CORS proxy in Settings → Network, or import the XMLTV file locally.'
    );
    expect(epgErrorMessage(cors)).toContain('CORS');
    expect(epgErrorMessage(cors)).not.toMatch(/storage is unavailable/i);

    const mixed = new EpgFetchError(
      'mixed-content',
      'The EPG URL (example.invalid) is plain HTTP while this app runs on HTTPS.'
    );
    expect(epgErrorMessage(mixed)).toContain('plain HTTP');
  });

  it('still maps storage failures that happen while persisting the guide', () => {
    const quota = new Error('quota exceeded');
    quota.name = 'QuotaExceededError';
    expect(epgErrorMessage(quota)).toMatch(/storage is full/i);
  });

  it('falls back to the raw message for unknown errors', () => {
    expect(epgErrorMessage(new Error('boom'))).toBe('boom');
    expect(epgErrorMessage('nope')).toBe('nope');
  });
});
