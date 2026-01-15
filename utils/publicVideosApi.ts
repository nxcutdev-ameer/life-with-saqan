import { fetchJson } from '@/utils/api';

const BASE_URL = 'https://api.saqan.com/api/public';

export interface PublicVideosResponse {
  data: PublicVideo[];
  meta?: {
    total?: number;
    per_page?: number;
    current_page?: number;
    last_page?: number;
    from?: number;
    to?: number;
    has_more_pages?: boolean;
  };
}

export interface PublicVideo {
  video_id: number;
  property_reference: string;
  title: string;
  description: string;
  status: string;
  processing_status: string;
  playback?: {
    local_url?: string | null;
    thumbnail_url?: string | null;
    poster_url?: string | null;
    stream_url?: string | null;
    can_stream?: boolean;
  };
  cloudflare?: {
    status?: string;
    playback_url?: string | null;
    thumbnail_url?: string | null;
    requires_signed_urls?: boolean;
  };
}

export async function fetchPublicVideos(params: { page: number; perPage?: number }) {
  const perPage = params.perPage ?? 20;
  const url = `${BASE_URL}/videos?per_page=${perPage}&page=${params.page}`;
  return fetchJson<PublicVideosResponse>(url, { method: 'GET' });
}
