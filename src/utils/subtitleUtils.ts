export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

export interface SubtitleTrackOption {
  id: string;
  label: string;
  url: string;
  lang: string;
  isDefault?: boolean;
}

/**
 * Ensures any external subtitle URL is routed through the server's /api/sub-sync proxy
 * to prevent browser CORS blocks, decompress gzip files, and convert SRT to WebVTT seamlessly.
 */
export function getSafeSubtitleUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  // If already proxied or local app endpoint
  if (
    trimmed.startsWith('/api/') ||
    trimmed.startsWith('/proxy/') ||
    trimmed.startsWith('/subtitles/')
  ) {
    return trimmed;
  }

  // Strip same origin prefix if present
  if (typeof window !== 'undefined') {
    try {
      const curOrigin = window.location.origin;
      if (trimmed.startsWith(curOrigin)) {
        return trimmed.slice(curOrigin.length);
      }
    } catch {
      // ignore
    }
  }

  // External URLs (e.g. sub.vnstream.io.vn, opensubtitles, yts) must be proxied
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return `/api/sub-sync?url=${encodeURIComponent(trimmed)}`;
  }

  return trimmed;
}

function parseTimecodeToSeconds(tc: string): number {
  if (!tc) return 0;
  const clean = tc.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const s = parseFloat(parts[2]) || 0;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const m = parseFloat(parts[0]) || 0;
    const s = parseFloat(parts[1]) || 0;
    return m * 60 + s;
  }
  return parseFloat(clean) || 0;
}

/**
 * Parses WebVTT or SRT subtitle text into an array of timed cues.
 * Strips HTML, tags, BOM, ASS codes, and handles diverse line ending types.
 */
export function parseSubtitleText(rawText: string): SubtitleCue[] {
  if (!rawText || typeof rawText !== 'string') return [];

  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^\uFEFF/, '');

  // Split by double newline or numbered block
  const blocks = normalized.split(/\n\s*\n+/);
  const cues: SubtitleCue[] = [];
  const timeRegex = /(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})/;

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    let timeLineIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 4); i++) {
      if (lines[i].includes('-->')) {
        timeLineIdx = i;
        break;
      }
    }
    if (timeLineIdx === -1) continue;

    const timeLine = lines[timeLineIdx];
    const match = timeLine.match(timeRegex);

    let start = 0;
    let end = 0;

    if (match) {
      const parseSec = (h: string | undefined, m: string, s: string, ms: string) => {
        const hours = h ? parseInt(h, 10) : 0;
        return hours * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10) + parseInt(ms, 10) / 1000;
      };
      start = parseSec(match[1], match[2], match[3], match[4]);
      end = parseSec(match[5], match[6], match[7], match[8]);
    } else {
      const arrowParts = timeLine.split('-->');
      if (arrowParts.length >= 2) {
        start = parseTimecodeToSeconds(arrowParts[0]);
        end = parseTimecodeToSeconds(arrowParts[1].split(/\s+/)[0]);
      }
    }

    if (isNaN(start) || isNaN(end) || end <= start) continue;

    const textLines = lines
      .slice(timeLineIdx + 1)
      .map((line) =>
        line
          .replace(/<[^>]+>/g, '') // Remove HTML tags
          .replace(/\{[^}]+\}/g, '') // Remove ASS styling tags like {\an8}
          .trim()
      )
      .filter((l) => l.length > 0 && !l.startsWith('WEBVTT') && !l.startsWith('NOTE'));

    if (textLines.length > 0) {
      cues.push({
        start,
        end,
        text: textLines.join('\n'),
      });
    }
  }

  // Sort chronologically
  cues.sort((a, b) => a.start - b.start);
  return cues;
}

/**
 * Classifies a stream into Priority Tier 1 (Thuyết Minh), Tier 2 (Vietsub), or Tier 3 (Other).
 */
export function getStreamPriorityInfo(stream: {
  name?: string;
  title?: string;
  url?: string;
  embedUrl?: string;
  externalUrl?: string;
  priorityTier?: number;
  audioLabel?: string;
}): {
  tier: 1 | 2 | 3;
  tierLabel: string;
  shortBadge: string;
  isDirectHls: boolean;
} {
  const rawName = String(stream.name || '');
  const rawTitle = String(stream.title || '');
  const cleanText = `${rawName} ${rawTitle}`
    .replace(/\[kèm phụ đề rời\]/gi, '')
    .toLowerCase();

  const isDirectHls = Boolean(
    stream.url &&
      !stream.url.includes('/api/player') &&
      !(!stream.url && (stream.embedUrl || stream.externalUrl))
  );

  const isTm =
    stream.priorityTier === 1 ||
    cleanText.includes('thuyết minh') ||
    cleanText.includes('thuyet minh') ||
    cleanText.includes('lồng tiếng') ||
    cleanText.includes('long tieng') ||
    cleanText.includes('song ngữ') ||
    cleanText.includes('song ngu') ||
    cleanText.includes('vie audio') ||
    cleanText.includes('viet audio') ||
    cleanText.includes('audio tiếng việt') ||
    cleanText.includes('audio tieng viet') ||
    /\b(tm|lt)\b/i.test(cleanText);

  if (isTm) {
    const isLt = cleanText.includes('lồng tiếng') || cleanText.includes('long tieng');
    return {
      tier: 1,
      tierLabel: isLt ? 'Ưu tiên #1: Lồng Tiếng' : 'Ưu tiên #1: Thuyết Minh',
      shortBadge: isLt ? 'Lồng Tiếng' : 'Thuyết Minh',
      isDirectHls,
    };
  }

  const isVietsub =
    stream.priorityTier === 2 ||
    cleanText.includes('vietsub') ||
    cleanText.includes('viet sub') ||
    cleanText.includes('phụ đề') ||
    cleanText.includes('phu de') ||
    cleanText.includes('tiếng việt') ||
    cleanText.includes('tieng viet') ||
    cleanText.includes('vietnamese') ||
    /\b(vsub|vs)\b/i.test(cleanText);

  if (isVietsub) {
    return {
      tier: 2,
      tierLabel: 'Ưu tiên #2: Vietsub',
      shortBadge: 'Vietsub',
      isDirectHls,
    };
  }

  return {
    tier: 3,
    tierLabel: 'Ưu tiên #3: Nguồn Khác',
    shortBadge: 'Nguồn Khác',
    isDirectHls,
  };
}
