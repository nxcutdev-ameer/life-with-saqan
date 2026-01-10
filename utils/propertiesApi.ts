import { fetchJson } from './api';

const BASE_URL = 'https://properties.vzite.com/api/v1';

export type GeoPoint = {
  type: 'Point';
  coordinates: [number, number];
};

export type Emirate = {
  id: number;
  name: string;
  center?: GeoPoint;
};

export type District = {
  id: number;
  name: string;
  center?: GeoPoint;
};

export type OffPlanDeveloper = {
  id: number;
  name: string;
  logo?: string;
};

export type OffPlanMediaItem = {
  id: number;
  type: string;
  upload?: {
    url?: string;
  };
};

export type OffPlanProjectListItem = {
  id: number;
  title: string;
  reference_id?: string;
  short_description?: string;
  type?: string;
  status?: number;
  coordinates?: [number, number];
  developer?: OffPlanDeveloper;
  emirate?: { id: number; name: string };
  district?: { id: number; name: string };
  media?: OffPlanMediaItem[];
};

export type OffPlanProjectsPayload = {
  properties: {
    data: OffPlanProjectListItem[];
    meta?: {
      current_page?: number;
      last_page?: number;
      per_page?: number;
      total?: number;
    };
    links?: {
      next?: string | null;
      prev?: string | null;
    };
  };
};

export type PaginatedPayload<T> = {
  current_page: number;
  data: T[];
  first_page_url?: string;
  from?: number;
  last_page: number;
  last_page_url?: string;
  next_page_url?: string | null;
  path?: string;
  per_page: number;
  prev_page_url?: string | null;
  to?: number;
  total: number;
};

export type ApiResponse<TPayload> = {
  success: boolean;
  payload: TPayload;
  message?: string;
};

export async function fetchEmirates(): Promise<Emirate[]> {
  const url = `${BASE_URL}/emirates?limit=999&size=mini`;
  const res = await fetchJson<ApiResponse<PaginatedPayload<Emirate>>>(url);
  return res.payload.data;
}

export async function fetchDistricts(emirateId: number): Promise<District[]> {
  const url = `${BASE_URL}/districts?limit=999&emirates_id=${encodeURIComponent(String(emirateId))}&size=mini`;
  const res = await fetchJson<ApiResponse<PaginatedPayload<District>>>(url);
  return res.payload.data;
}

export async function fetchOffPlanProjects(options?: {
  page?: number;
  limit?: number;
}): Promise<{ data: OffPlanProjectListItem[]; currentPage: number; lastPage: number | null }> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;

  const url = `${BASE_URL}/properties/offplan/elastic?view=list&order_by=created_at&size=xs&page=${encodeURIComponent(
    String(page)
  )}&limit=${encodeURIComponent(String(limit))}`;

  const res = await fetchJson<ApiResponse<OffPlanProjectsPayload>>(url);
  const data = res.payload.properties.data;
  const currentPage = res.payload.properties.meta?.current_page ?? page;
  const lastPage = res.payload.properties.meta?.last_page ?? null;
  return { data, currentPage, lastPage };
}
