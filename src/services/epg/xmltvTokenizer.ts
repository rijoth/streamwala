/**
 * Streaming, tolerant XMLTV tokenizer. No DOMParser, so a 100 MB file does not
 * build a DOM. Feed it decoded chunks; it emits `<channel>` and `<programme>`
 * records as soon as their closing tag arrives and recovers from malformed
 * markup by finalizing whatever context is open and counting an error.
 */

export interface XmltvRawChannel {
  id: string;
  displayNames: string[];
  icon?: string;
}

export interface XmltvRawProgramme {
  channel: string;
  start: string;
  stop?: string;
  title?: string;
  subTitle?: string;
  description?: string;
  category?: string;
  icon?: string;
  rating?: string;
  episodeNumber?: string;
  language?: string;
}

export interface XmltvTokenizerStats {
  channels: number;
  programmes: number;
  errors: number;
}

export interface XmltvTokenizerHandlers {
  onChannel?: (channel: XmltvRawChannel) => void;
  onProgramme?: (programme: XmltvRawProgramme) => void;
  onError?: (message: string) => void;
}

export interface XmltvTokenizer {
  push(chunk: string): void;
  end(): void;
  readonly stats: XmltvTokenizerStats;
}

const TEXT_ELEMENTS = new Set([
  'display-name',
  'title',
  'sub-title',
  'desc',
  'category',
  'rating',
  'language',
  'episode-num',
]);

const ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

export function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => ENTITY_MAP[name.toLowerCase()] ?? match);
}

function findTagEnd(buffer: string, start: number): number {
  let quote = '';
  for (let i = start + 1; i < buffer.length; i++) {
    const ch = buffer[i];
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '>') return i;
  }
  return -1;
}

function parseAttributes(attributeText: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const re = /([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(attributeText)) !== null) {
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attributes.set(match[1].toLowerCase(), decodeXmlEntities(value));
  }
  return attributes;
}

export function createXmltvTokenizer(handlers: XmltvTokenizerHandlers = {}): XmltvTokenizer {
  let buffer = '';
  let context: 'channel' | 'programme' | null = null;
  let currentChannel: XmltvRawChannel | null = null;
  let currentProgramme: XmltvRawProgramme | null = null;
  let textElement: string | null = null;
  let textBuffer = '';
  const stats: XmltvTokenizerStats = { channels: 0, programmes: 0, errors: 0 };

  const reportError = (message: string) => {
    stats.errors++;
    handlers.onError?.(message);
  };

  const appendText = () => {
    if (!textElement) return;
    const value = decodeXmlEntities(textBuffer).trim();
    textBuffer = '';
    if (!value) return;
    if (context === 'channel' && currentChannel) {
      if (textElement === 'display-name') currentChannel.displayNames.push(value);
    } else if (context === 'programme' && currentProgramme) {
      if (textElement === 'title') currentProgramme.title = value;
      else if (textElement === 'sub-title') currentProgramme.subTitle = value;
      else if (textElement === 'desc') currentProgramme.description = value;
      else if (textElement === 'category') currentProgramme.category = value;
      else if (textElement === 'rating') currentProgramme.rating = value;
      else if (textElement === 'language') currentProgramme.language = value;
      else if (textElement === 'episode-num') currentProgramme.episodeNumber = value;
    }
  };

  const finalizeChannel = () => {
    if (currentChannel) {
      if (currentChannel.id) {
        stats.channels++;
        handlers.onChannel?.(currentChannel);
      } else {
        reportError('Skipped a <channel> without an id.');
      }
    }
    currentChannel = null;
    context = null;
  };

  const finalizeProgramme = () => {
    if (currentProgramme) {
      if (currentProgramme.channel) {
        stats.programmes++;
        handlers.onProgramme?.(currentProgramme);
      } else {
        reportError('Skipped a <programme> without a channel.');
      }
    }
    currentProgramme = null;
    context = null;
  };

  const finalizeContext = () => {
    if (context === 'channel') finalizeChannel();
    else if (context === 'programme') finalizeProgramme();
  };

  const recoverIfOpen = () => {
    if (context) reportError(`Recovered from an unclosed <${context}>.`);
    finalizeContext();
  };

  const handleOpen = (name: string, attributes: Map<string, string>, selfClosing: boolean) => {
    if (name === 'channel') {
      recoverIfOpen();
      currentChannel = { id: attributes.get('id') ?? '', displayNames: [] };
      context = 'channel';
      return;
    }
    if (name === 'programme') {
      recoverIfOpen();
      currentProgramme = {
        channel: attributes.get('channel') ?? '',
        start: attributes.get('start') ?? '',
        stop: attributes.get('stop'),
      };
      context = 'programme';
      return;
    }
    if (name === 'icon') {
      const src = attributes.get('src');
      if (src && context === 'channel' && currentChannel) currentChannel.icon = src;
      else if (src && context === 'programme' && currentProgramme) currentProgramme.icon = src;
      return;
    }
    if (TEXT_ELEMENTS.has(name)) {
      textElement = selfClosing ? null : name;
      textBuffer = '';
    }
  };

  const handleTag = (tag: string) => {
    const selfClosing = tag.endsWith('/');
    const content = selfClosing ? tag.slice(0, -1) : tag;
    const isClose = content.startsWith('/');
    const body = isClose ? content.slice(1) : content;
    const separator = body.search(/[\s/]/);
    const name = (separator === -1 ? body : body.slice(0, separator)).trim().toLowerCase();
    if (!name) return;

    if (isClose) {
      if (name === 'channel') finalizeChannel();
      else if (name === 'programme') finalizeProgramme();
      else if (name === textElement) {
        appendText();
        textElement = null;
      }
      return;
    }

    const attributeText = separator === -1 ? '' : body.slice(separator + 1);
    handleOpen(name, parseAttributes(attributeText), selfClosing);
  };

  const process = () => {
    for (;;) {
      const lt = buffer.indexOf('<');
      if (lt === -1) {
        if (textElement) textBuffer += buffer;
        buffer = '';
        return;
      }
      if (lt > 0) {
        const text = buffer.slice(0, lt);
        if (textElement) textBuffer += text;
        buffer = buffer.slice(lt);
      }

      if (buffer.startsWith('<!--')) {
        const end = buffer.indexOf('-->');
        if (end === -1) return;
        buffer = buffer.slice(end + 3);
        continue;
      }
      if (buffer.startsWith('<![CDATA[')) {
        const end = buffer.indexOf(']]>');
        if (end === -1) return;
        if (textElement) textBuffer += buffer.slice(9, end);
        buffer = buffer.slice(end + 3);
        continue;
      }
      if (buffer.startsWith('<?') || buffer.startsWith('<!')) {
        const end = findTagEnd(buffer, 0);
        if (end === -1) return;
        buffer = buffer.slice(end + 1);
        continue;
      }

      const end = findTagEnd(buffer, 0);
      if (end === -1) return;
      const tag = buffer.slice(1, end);
      buffer = buffer.slice(end + 1);
      handleTag(tag);
    }
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      process();
    },
    end() {
      process();
      if (textElement) {
        appendText();
        textElement = null;
      }
      if (context) {
        reportError('Recovered from an unclosed element at end of document.');
        finalizeContext();
      }
    },
    get stats() {
      return { ...stats };
    },
  };
}
