export type HlsSubtitleTrack = { language?: string; name?: string; uri: string };

/**
 * Minimal parser for an HLS master playlist to extract SUBTITLES media URIs.
 *
 * Supports lines like:
 * #EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="sub1",LANGUAGE="en",NAME="English",URI="subtitles/en.m3u8"
 */
export function parseHlsSubtitleTracks(playlistText: string, baseUrl: string): HlsSubtitleTrack[] {
  const lines = playlistText.split(/\r?\n/);
  const tracks: HlsSubtitleTrack[] = [];

  for (const line of lines) {
    if (!line.startsWith('#EXT-X-MEDIA:')) continue;
    if (!line.includes('TYPE=SUBTITLES')) continue;

    const attrsText = line.slice('#EXT-X-MEDIA:'.length);
    const attrs: Record<string, string> = {};

    // Parse comma-separated key=value pairs, where value may be quoted.
    // This is intentionally simple and works for typical HLS attribute lists.
    const re = /([A-Z0-9-]+)=(("[^"]*")|[^,]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(attrsText))) {
      const key = m[1];
      let value = m[2] ?? '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      attrs[key] = value;
    }

    const uri = attrs['URI'];
    if (!uri) continue;

    tracks.push({
      language: attrs['LANGUAGE'],
      name: attrs['NAME'],
      uri: absolutizeUrl(uri, baseUrl),
    });
  }

  return tracks;
}

export function absolutizeUrl(maybeRelative: string, baseUrl: string): string {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return maybeRelative;
  }
}

/**
 * Given a master playlist URL, fetch it and pick the subtitle track for a language code.
 * Returns the subtitle playlist URI (often an .m3u8) if present.
 */
export async function resolveSubtitleTrackFromHlsMaster(params: {
  masterUrl: string;
  languageCode: string;
}): Promise<string | null> {
  const res = await fetch(params.masterUrl, { headers: { Accept: 'application/x-mpegURL' } });
  if (!res.ok) return null;
  const text = await res.text();

  const tracks = parseHlsSubtitleTracks(text, params.masterUrl);
  const found = tracks.find((t) => (t.language ?? '').toLowerCase() === params.languageCode.toLowerCase());
  return found?.uri ?? null;
}

/**
 * Fetch a subtitle playlist (m3u8) and return a list of segment URIs.
 * Cloudflare subtitle playlists usually reference .vtt segments.
 */
export async function fetchSubtitleSegmentUrisFromPlaylist(playlistUrl: string): Promise<string[]> {
  const res = await fetch(playlistUrl, { headers: { Accept: 'application/x-mpegURL' } });
  if (!res.ok) return [];
  const text = await res.text();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const segs: string[] = [];
  for (const l of lines) {
    if (l.startsWith('#')) continue;
    segs.push(absolutizeUrl(l, playlistUrl));
  }
  return segs;
}
