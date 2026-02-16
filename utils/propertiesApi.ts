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
  emirateId?: number | null;
  districtId?: number | null;
}): Promise<ApiResponse<PaginatedPayload<Building>>> {
  const page = params.page ?? 1;
  let url = `${BASE_URL}/buildings?page=${encodeURIComponent(String(page))}`;
  
  if (params.emirateId) {
    url += `&emirate_id=${encodeURIComponent(String(params.emirateId))}`;
  }
  
  if (params.districtId) {
    url += `&district_id=${encodeURIComponent(String(params.districtId))}`;
  }
  
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
  name?: string;
}): Promise<{ data: OffPlanProjectListItem[]; currentPage: number; lastPage: number | null }> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;

  const nameParam = options?.name?.trim();

  const url = `${BASE_URL}/properties/offplan/elastic?view=list&order_by=created_at&size=xs&page=${encodeURIComponent(
    String(page)
  )}&limit=${encodeURIComponent(String(limit))}${
    nameParam ? `&name=${encodeURIComponent(nameParam)}` : ''
  }`;

  const res = await fetchJson<ApiResponse<OffPlanProjectsPayload>>(url);
  const data = res.payload.properties.data;
  const currentPage = res.payload.properties.meta?.current_page ?? page;
  const lastPage = res.payload.properties.meta?.last_page ?? null;
  return { data, currentPage, lastPage };
}

export type PropertyAmenity = {
  id: number;
  name: string;
  icon?: string;
};

export type PropertyDetailsPayload = {
  reference_id: string;
  title: string;
  description: string;
  type?: string;
  permit?: string | null;
  rera?: string | null;
  dtcm?: string | null;
  state?: string;
  trakheesi?: string | null;
  rera_licence_id?: string | null;
  default_pricing?: string | null;
  meta?: {
    sale_price?: string | number | null;
    week_price?: string | number | null;
    month_price?: string | number | null;
    year_price?: string | number | null;
    bedrooms?: string | number | null;
    furnished?: string | number | null;
    bathrooms?: string | number | null;
    built_year?: string | number | null;
    garage?: string | number | null;
    block?: string | null;
    floor?: string | number | null;
    size?: string | number | null;
    square?: string | number | null;
    seo_title?: string | null;
    seo_description?: string | null;
  };
  agency?: {
    agency_name?: string | null;
  } | null;
  agent?: {
    id?: number | null;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    avatar?: {
      url?: string | null;
    } | null;
  } | null;
  developer?: unknown | null;
  district?: {
    id: number;
    name: string;
    description?: string | null;
  } | null;
  emirate?: {
    id: number;
    name: string;
    description?: string | null;
  } | null;
  area?: {
    id: number;
    name: string;
    slug?: string;
    status?: number;
    is_deleted?: number;
  } | null;
  building?: {
    name?: string | null;
    slug?: string | null;
  } | null;
  coordinates?: unknown;
  media?: Array<{
    id?: number;
    type?: string;
    url?: string;
    file?: string;
    path?: string;
    original_url?: string;
    thumbnail_url?: string;
  }>;
  media_meta?: any[];
  amenities?: Array<{
    id: number;
    name: string;
    icon?: string;
  }>;
};

export async function fetchPropertyByReferenceResponse(
  referenceId: string,
  options?: { timeoutMs?: number }
): Promise<ApiResponse<PropertyDetailsPayload>> {
  const url = `${BASE_URL}/properties/public/${encodeURIComponent(referenceId)}`;

  return fetchJson<ApiResponse<PropertyDetailsPayload>>(url, {
    timeoutMs: options?.timeoutMs ?? 15000,
  });
}

export async function fetchPropertyByReference(referenceId: string): Promise<PropertyDetailsPayload> {
  const res = await fetchPropertyByReferenceResponse(referenceId);
  return res.payload;
}


export async function fetchOffPlanPropertyByReference(
  referenceId: string,
  options?: { timeoutMs?: number }
): Promise<ApiResponse<PropertyDetailsPayload>> {
  const url = `${BASE_URL}/properties/offplan/${encodeURIComponent(referenceId)}`;
  console.log('[fetchOffPlanPropertyByReference] URL:', url);
  console.log('[fetchOffPlanPropertyByReference] referenceId:', referenceId);

  return fetchJson<ApiResponse<PropertyDetailsPayload>>(url, {
    timeoutMs: options?.timeoutMs ?? 15000,
  });
}

// --- Property media helpers ---

export type UploadMediaPayload = {
  id: number;
  info?: string;
  original_path?: string;
  thumbnail_path?: string;
  big_image_path?: string;
  original_url?: string;
  thumbnail_url?: string;
  big_image_url?: string;
};

export async function uploadMedia(params: {
  propertiesToken: string;
  uri: string;
  featured?: '0' | '1';
}): Promise<ApiResponse<UploadMediaPayload>> {
  const form = new FormData();
  const fileName = params.uri.split('/').pop() || 'image.jpg';
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  form.append('file', {
    uri: params.uri,
    name: fileName,
    type: mime,
  } as any);
  form.append('featured', params.featured ?? '1');

  const url = `${BASE_URL}/media`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${params.propertiesToken}`,
    },
    body: form,
  });
  const text = await res.text();
  const body = text ? ((): any => { try { return JSON.parse(text); } catch { return null; } })() : null;

  if (!res.ok) {
    const message = body?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return body as ApiResponse<UploadMediaPayload>;
}

export type AttachPropertyMediaPayload = {
  id: number;
};

export async function attachPropertyMedia(params: {
  propertiesToken: string;
  referenceId: string;
  type: string;
  upload_id: string | number;
}): Promise<{ success: boolean; data?: AttachPropertyMediaPayload; message?: string }> {
  const url = `${BASE_URL}/properties/${encodeURIComponent(params.referenceId)}/media`;
  const res = await fetchJson<ApiResponse<AttachPropertyMediaPayload>>(url, {
    method: 'POST',
    timeoutMs: 30000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.propertiesToken}`,
    },
    body: JSON.stringify({
      type: params.type,
      upload_id: params.upload_id,
    }),
  });

  const obj: { success: boolean; data?: AttachPropertyMediaPayload; message?: string } = {
    success: res.success,
  };
  if (res.success) obj.data = res.payload;
  if (!res.success) obj.message = res.message;
  return obj;
}

export async function unAttachPropertyMedia(params: {
  propertiesToken: string;
  referenceId: string;
  id: string | number;
}): Promise<{ success: boolean; data?: unknown; message?: string }> {
  const url = `${BASE_URL}/properties/${encodeURIComponent(params.referenceId)}/media/${encodeURIComponent(
    Number(params.id)
  )}`;

  const res = await fetchJson<ApiResponse<unknown>>(url, {
    method: 'DELETE',
    timeoutMs: 30000,
    headers: {
      Authorization: `Bearer ${params.propertiesToken}`,
    },
  });

  const obj: { success: boolean; data?: unknown; message?: string } = { success: res.success };
  if (res.success) obj.data = res.payload;
  if (!res.success) obj.message = res.message;
  return obj;
}
