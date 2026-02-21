import type { Property, PropertyType } from '@/types';

// Shared mapping logic for Saqan public videos -> app Property model.

// Public video endpoints are served from saqan.com, and relative playback URLs
// returned by the public API are hosted on the main site.
const API_ORIGIN = 'https://www.saqan.com';

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
  // Some backends append query params to .m3u8/.mp4 URLs, so we must handle that too.
  const hasM3u8 = u.includes('.m3u8');
  const hasMp4 = u.includes('.mp4');

  return hasM3u8 || hasMp4 || u.includes('/manifest/') || u.includes('manifest/video.m3u8');
};

const pickPlaybackUrl = (v: any): { url: string } => {
  // 1) Prefer HLS manifest URLs.
  if (v?.playback?.can_stream && isDirectMediaUrl(v?.playback?.stream_url)) {
    return { url: v.playback.stream_url };
  }

  if (v?.cloudflare) {
    // Some videos can be playable before Cloudflare reports READY (e.g. status=UPLOADING/PROCESSING)
    // as long as the API returns a direct HLS/MP4 URL.
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

  // Subtitles shape can vary by endpoint/version.
  // Newer payloads may expose subtitles at `v.subtitles`, older at `v.cloudflare.subtitles`.
  const rawSubtitles = (v?.subtitles ?? v?.cloudflare?.subtitles ?? []) as any[];

  const subtitles = rawSubtitles
    .filter((s) => {
      const status = String(s?.status ?? '').toUpperCase();
      return !status || status === 'READY';
    })
    // Product requirement: remove Spanish from language list.
    .filter((s) => String(s?.language_code || '') !== 'es')
    .map((s: any) => ({
      code: String(s?.language_code || ''),
      label: s?.label,
      // Backend commonly returns relative paths like `/storage/...`.
      // Subtitles are served from the main site, same as other public media.
      url: s?.url ? toAbsoluteUrl(String(s.url)) : null,
      filePath: s?.file_path ?? null,
    }))
    .filter((s: any) => Boolean(s.code));

  const backendProperty = v?.property;
  const meta = backendProperty?.meta;

  const title = backendProperty?.title || backendProperty?.name || v.title || 'Untitled';
  const defaultPricing = backendProperty?.default_pricing || null;

  const isOffplan = backendProperty?.type === 'offplan';

  // Some endpoints return offplan properties with range objects, e.g.
  // property.price = { from, to }, property.square = { from, to }.
  const offplanPriceFrom = toNumberOrZero(backendProperty?.price?.from);
  const offplanPriceTo = toNumberOrZero(backendProperty?.price?.to);
  const offplanSquareFrom = toNumberOrZero(backendProperty?.square?.from);
  const offplanSquareTo = toNumberOrZero(backendProperty?.square?.to);

  let priceField = 0;
  if (isOffplan) {
    priceField = offplanPriceFrom || offplanPriceTo;
  } else if (defaultPricing === null) {
    priceField = meta?.sale_price;
  } else {
    priceField = defaultPricing === 'week' ? meta?.week_price : defaultPricing === 'year' ? meta?.year_price : meta?.month_price;
  }

  const price = toNumberOrZero(priceField);
  const priceTo = isOffplan ? offplanPriceTo : undefined;

  const bedrooms = isOffplan ? toNumberOrZero(backendProperty?.bedrooms?.from) : toNumberOrZero(meta?.bedrooms);
  const bathrooms = isOffplan ? toNumberOrZero(backendProperty?.bathrooms?.from) : toNumberOrZero(meta?.bathrooms);
  const sizeSqft = isOffplan ? (offplanSquareFrom || offplanSquareTo) : toNumberOrZero(meta?.square);
  const sizeSqftTo = isOffplan ? offplanSquareTo : undefined;

  const city = backendProperty?.emirate?.name || '';
  const area = backendProperty?.district?.name || '';

  const agentId = v?.agent?.agent_id ?? v?.agent?.company_employee?.id;
  const agentName = (v?.agent?.company_employee?.name ?? '').trim();

  return {
    id: String(v.video_id),
    // Preserve backend transaction type for strict feed filtering (RENT/BUY/SALE/STAY)
    transactionType: meta?.type ?? backendProperty?.type ?? undefined,
    // Preserve backend property type (sale/rent/offplan) for routing.
    type: backendProperty?.type ?? undefined,
    propertyReference: v?.property_reference ?? backendProperty?.reference_id ?? backendProperty?.referenceId ?? null,
    title,
    description: backendProperty?.description || v.description || '',
    rooms,
    subtitles,
    defaultPricing: defaultPricing ?? undefined,
    price,
    priceTo: priceTo && priceTo !== price ? priceTo : undefined,
    currency: 'AED',
    listingType: backendProperty?.type === 'rent' ? 'RENT' : 'BUY',
    propertyType: 'apartment' as PropertyType,
    bedrooms,
    bathrooms,
    sizeSqft,
    sizeSqftTo: sizeSqftTo && sizeSqftTo !== sizeSqft ? sizeSqftTo : undefined,
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
