import type { Property, PropertyType } from '@/types';

// Shared mapping logic for Saqan public videos -> app Property model.

const API_ORIGIN = 'https://api.saqan.com';

const toAbsoluteUrl = (maybePath?: string | null) => {
  if (!maybePath) return '';
  if (maybePath.startsWith('http://') || maybePath.startsWith('https://')) return maybePath;
  if (maybePath.startsWith('/')) return `${API_ORIGIN}${maybePath}`;
  return `${API_ORIGIN}/${maybePath}`;
};

const isDirectMediaUrl = (url?: string | null) => {
  if (!url) return false;
  const u = url.toLowerCase();
  // We only want URLs that point to actual media, not Cloudflare's HTML watch page.
  return u.endsWith('.m3u8') || u.endsWith('.mp4') || u.includes('/manifest/') || u.includes('manifest/video.m3u8');
};

const pickPlaybackUrl = (v: any): { url: string } => {
  // 1) Prefer HLS manifest URLs.
  if (v?.playback?.can_stream && isDirectMediaUrl(v?.playback?.stream_url)) {
    return { url: v.playback.stream_url };
  }

  if (v?.cloudflare?.status === 'READY' && v?.cloudflare?.requires_signed_urls === false) {
    if (isDirectMediaUrl(v?.cloudflare?.stream_url)) {
      return { url: v.cloudflare.stream_url };
    }
    if (isDirectMediaUrl(v?.cloudflare?.playback_url)) {
      return { url: v.cloudflare.playback_url };
    }
  }

  // 2) MP4 fallback.
  if (isDirectMediaUrl(v?.playback?.local_url)) {
    return { url: toAbsoluteUrl(v.playback.local_url) };
  }
  if (v?.playback?.local_url) {
    return { url: toAbsoluteUrl(v.playback.local_url) };
  }

  // 3) As a last resort, return empty so we can show a placeholder.
  return { url: '' };
};

const prettifyRoomKey = (key: string) => {
  if (!key) return '';
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
};

const mapRoomTimestampsToRooms = (roomTimestamps: any): { name: string; timestamp: number }[] => {
  if (!roomTimestamps || typeof roomTimestamps !== 'object') return [];
  return Object.entries(roomTimestamps)
    .map(([key, value]: any) => ({
      name: prettifyRoomKey(String(key)),
      timestamp: Number(value?.start ?? 0),
    }))
    .filter((r) => Number.isFinite(r.timestamp) && r.timestamp >= 0)
    .sort((a, b) => a.timestamp - b.timestamp);
};

const toNumberOrZero = (value: any) => {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) ? n : 0;
};

export function mapPublicVideoToProperty(v: any): Property {
  const picked = pickPlaybackUrl(v);
  const videoUrl = picked.url;

  const thumbUrl = v?.cloudflare?.thumbnail_url || v?.playback?.thumbnail_url;
  const rooms = mapRoomTimestampsToRooms(v?.property_video_metadata?.room_timestamps);
  const subtitles = (v?.cloudflare?.subtitles ?? [])
    .map((s: any) => ({
      code: String(s?.language_code || ''),
      label: s?.label,
      url: s?.url ?? null,
      filePath: s?.file_path ?? null,
    }))
    .filter((s: any) => Boolean(s.code));

  const backendProperty = v?.property;
  const meta = backendProperty?.meta;

  const title = backendProperty?.title || backendProperty?.name || v.title || 'Untitled';
  const defaultPricing = backendProperty?.default_pricing || null;

  let priceField = 0;
  if (defaultPricing === null) {
    priceField = meta?.sale_price;
  } else {
    priceField = defaultPricing === 'week' ? meta?.week_price : defaultPricing === 'year' ? meta?.year_price : meta?.month_price;
  }

  const price = toNumberOrZero(priceField);

  const bedrooms = toNumberOrZero(meta?.bedrooms);
  const bathrooms = toNumberOrZero(meta?.bathrooms);
  const sizeSqft = toNumberOrZero(meta?.square);

  const city = backendProperty?.emirate?.name || '';
  const area = backendProperty?.district?.name || '';

  const agentId = v?.agent?.agent_id ?? v?.agent?.company_employee?.id;
  const agentName = (v?.agent?.company_employee?.name ?? '').trim();

  return {
    id: String(v.video_id),
    propertyReference: v?.property_reference,
    title,
    description: backendProperty?.description || v.description || '',
    rooms,
    subtitles,
    defaultPricing: defaultPricing ?? undefined,
    price,
    currency: 'AED',
    listingType: backendProperty?.type === 'rent' ? 'RENT' : 'BUY',
    propertyType: 'apartment' as PropertyType,
    bedrooms,
    bathrooms,
    sizeSqft,
    location: { city, area, latitude: 0, longitude: 0 },
    videoUrl,
    thumbnailUrl: thumbUrl || '',
    images: [],
    amenities: [],
    lifestyle: [],
    agent: {
      id: String(agentId ?? '1'),
      name: agentName || 'Agent',
      agency: 'Saqan',
      photo: v?.agent?.company_employee?.avatar?.url ?? '',
      phone: v?.agent?.company_employee?.phone ?? '',
      email: v?.agent?.company_employee?.email ?? '',
      isVerified: true,
      agentId: agentId ?? undefined,
    },
    agentName: agentName || 'Agent',
    agentPhoto: v?.agent?.company_employee?.avatar?.url ?? '',
    likesCount: v?.engagement?.likes_count ?? 0,
    savesCount: 0,
    sharesCount: v?.engagement?.shares_count ?? 0,
    commentsCount: v?.engagement?.comments_count ?? 0,
  };
}
