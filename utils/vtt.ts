export type VttCue = { start: number; end: number; text: string };

function parseTimestampToSeconds(ts: string): number {
  // Supports: HH:MM:SS.mmm or MM:SS.mmm
  const parts = ts.trim().split(':');
  if (parts.length < 2) return 0;

  const last = parts[parts.length - 1];
  const [secStr, msStr = '0'] = last.split('.');
  const seconds = Number(secStr);
  const ms = Number(msStr.padEnd(3, '0').slice(0, 3));

  const minutes = Number(parts[parts.length - 2]);
  const hours = parts.length === 3 ? Number(parts[0]) : 0;

  const total = hours * 3600 + minutes * 60 + seconds + ms / 1000;
  return Number.isFinite(total) ? total : 0;
}

export function parseVtt(vttText: string): VttCue[] {
  const lines = vttText.replace(/\r/g, '').split('\n');
  const cues: VttCue[] = [];

  let i = 0;
  // Skip file header / metadata (WEBVTT, NOTE blocks, X-TIMESTAMP-MAP, etc.)
  // until we reach the first cue timing line.
  while (i < lines.length) {
    const line = lines[i]?.trim() ?? '';
    if (!line) {
      i++;
      continue;
    }
    // First timing line marks start of cues.
    if (line.includes('-->')) break;
    i++;
  }

  while (i < lines.length) {
    // optional cue identifier
    if (lines[i] && !lines[i].includes('-->') && lines[i + 1]?.includes('-->')) {
      i++;
    }

    const timing = lines[i];
    if (!timing || !timing.includes('-->')) {
      i++;
      continue;
    }

    const [startRaw, endRaw] = timing.split('-->').map((s) => s.trim().split(' ')[0]);
    const start = parseTimestampToSeconds(startRaw);
    const end = parseTimestampToSeconds(endRaw);

    i++;
    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      textLines.push(lines[i]);
      i++;
    }

    const text = textLines.join('\n').trim();
    if (text) cues.push({ start, end, text });

    while (i < lines.length && lines[i].trim() === '') i++;
  }

  return cues;
}

export function findActiveCue(cues: VttCue[], timeSec: number): string {
  const cue = cues.find((c) => timeSec >= c.start && timeSec <= c.end);
  return cue?.text ?? '';
}
