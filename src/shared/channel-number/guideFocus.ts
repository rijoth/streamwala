import type { Channel } from '../../domain/types.ts';

type GuideFocusHandler = (channel: Channel) => boolean;

/**
 * The shell owns number entry, but only the guide knows how to scroll and
 * focus a virtualized row. The guide registers a handler while mounted; the
 * shell calls it for the `focus` action in the shared config.
 */
const handlers = new Set<GuideFocusHandler>();

export function registerGuideChannelFocus(handler: GuideFocusHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/** Returns true when a mounted guide accepted the request. */
export function requestGuideChannelFocus(channel: Channel): boolean {
  for (const handler of handlers) {
    if (handler(channel)) return true;
  }
  return false;
}
