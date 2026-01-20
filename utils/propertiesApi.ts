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

export type Amenity = {
  id: number;
  name: string;
  icon?: string;
  category?: string;
};

export async function fetchAmenities(params: { propertiesToken: string }): Promise<Amenity[]> {
  const url = `${BASE_URL}/amenities`;
  const res = await fetchJson<ApiResponse<Amenity[]>>(url, {
    headers: {
      Authorization: `Bearer ${params.propertiesToken}`,
    },
  });
  return res.payload;
}

export type Building = {
  id: number;
  name: string;
  slug: string;
};

export async function fetchBuildings(params: {
  propertiesToken: string;
  page?: number;
}): Promise<ApiResponse<PaginatedPayload<Building>>> {
  const page = params.page ?? 1;
  const url = `${BASE_URL}/buildings?page=${encodeURIComponent(String(page))}`;
  return fetchJson<ApiResponse<PaginatedPayload<Building>>>(url, {
    headers: {
      Authorization: `Bearer ${params.propertiesToken}`,
    },
  });
}

export type Area = {
  id: number;
  name: string;
  slug: string;
};

export async function fetchAreas(params: {
  propertiesToken: string;
  limit?: number;
}): Promise<Area[]> {
  const limit = params.limit ?? 9999;
  const url = `${BASE_URL}/areas?limit=${encodeURIComponent(String(limit))}`;
  const res = await fetchJson<ApiResponse<PaginatedPayload<Area>>>(url, {
    headers: {
      Authorization: `Bearer ${params.propertiesToken}`,
    },
  });
  return res.payload.data;
}

export type CreateDraftPropertyResponse = ApiResponse<{ reference_id: string }>;

export type UpdatePropertyResponse = ApiResponse<unknown>;

export type UpdatePropertyPayload = Record<string, unknown>;

export async function updateProperty(params: {
  propertiesToken: string;
  referenceId: string;
  body: UpdatePropertyPayload;
}): Promise<UpdatePropertyResponse> {
  const url = `${BASE_URL}/properties/${encodeURIComponent(params.referenceId)}`;
  return fetchJson<UpdatePropertyResponse>(url, {
    method: 'PUT',
    timeoutMs: 30000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.propertiesToken}`,
    },
    body: JSON.stringify(params.body),
  });
}

export async function createDraftProperty(params: {
  propertiesToken: string;
  type: 'sale' | 'rent' | 'offplan';
  state: 'draft' | 'active' | 'inactive' | 'sold' | 'rented';
}): Promise<CreateDraftPropertyResponse> {
  const url = `${BASE_URL}/properties`;
  return fetchJson<CreateDraftPropertyResponse>(url, {
    method: 'POST',
    timeoutMs: 30000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.propertiesToken}`,
    },
    body: JSON.stringify({
      type: params.type,
      state: params.state,
    }),
  });
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
