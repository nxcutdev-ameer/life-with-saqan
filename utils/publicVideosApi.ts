import { fetchJson } from '@/utils/api';

const BASE_URL = 'https://www.saqan.com/api/public';

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
  agent?: {
    agent_id?: number;
    company_employee?: {
      id?: number;
      name?: string;
      email?: string;
      phone?: string;
      avatar?: { id?: number; url?: string | null };
      company_id?: number | null;
      status?: number;
    };
  };
  property_reference: string;
  title: string;
  description: string;
  status: string;
  processing_status: string;
  property?: {
    type?: 'sale' | 'rent' | string;
    title?: string;
    name?: string;
    description?: string;
    default_pricing?: string;
    meta?: {
      month_price?: string | number | null;
      week_price?: string | number | null;
      year_price?: string | number | null;
      bedrooms?: string | number | null;
      bathrooms?: string | number | null;
      size?: string | number | null;
    };
    emirate?: { id?: number; name?: string };
    district?: { id?: number; name?: string };
  };
  property_video_metadata?: {
    room_timestamps?: Record<
      string,
      {
        start: number;
        end: number;
        duration?: number;
        description?: string;
        thumbnail_time?: number;
      }
    >;
  };
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
    stream_url?: string | null;
    thumbnail_url?: string | null;
    requires_signed_urls?: boolean;
    subtitles?: Array<{
      subtitle_id?: number;
      language_code?: string;
      language_name?: string | null;
      label?: string;
      url?: string | null;
      file_path?: string | null;
      status?: string;
    }>;
  };
}

export async function fetchPublicVideos(params: { page: number; perPage?: number }) {
  const perPage = params.perPage ?? 20;
  const url = `${BASE_URL}/videos?per_page=${perPage}&page=${params.page}`;
  return fetchJson<PublicVideosResponse>(url, { method: 'GET' });
}

export async function fetchPublicAgentVideos(params: { agentId: number | string; page?: number; perPage?: number }) {
  const perPage = params.perPage ?? 20;
  const page = params.page ?? 1;
  const url = `${BASE_URL}/videos/agent/${params.agentId}?per_page=${perPage}&page=${page}`;
  return fetchJson<PublicVideosResponse>(url, { method: 'GET' });
}

export type PublicVideoLikeResponse = {
  message?: string;
  data?: {
    likes_count?: number;
    dislikes_count?: number;
  };
};

export async function setPublicVideoLike(params: { videoId: number | string; liked: boolean }) {
  const url = `${BASE_URL}/videos/${params.videoId}/like`;
  return fetchJson<PublicVideoLikeResponse>(url, {
    method: params.liked ? 'POST' : 'DELETE',
  });
}

export type PublicVideoShareResponse = {
  message?: string;
  data?: {
    shares_count?: number;
    platform?: string;
  };
};

export async function sharePublicVideo(params: { videoId: number | string }) {
  const url = `${BASE_URL}/videos/${params.videoId}/share`;
  return fetchJson<PublicVideoShareResponse>(url, { method: 'POST' });
}
