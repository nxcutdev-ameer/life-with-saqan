import { fetchJson } from '@/utils/api';

const BASE_URL = 'https://backoffice.vzite.com/api/v1/profile';

export type UpdateBrokerIdResponse = {
  success: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function updateBrokerId(params: {
  brokerNumber: string;
  backofficeToken: string;
}): Promise<UpdateBrokerIdResponse> {
  return fetchJson<UpdateBrokerIdResponse>(`${BASE_URL}/update-brokerid`, {
    method: 'POST',
    timeoutMs: 30000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.backofficeToken}`,
    },
    body: JSON.stringify({ broker_number: params.brokerNumber }),
  });
}

export type UploadAvatarResponse = {
  success: boolean;
  message?: string;
  payload?: {
    avatar_url?: string | null;
  };
  [key: string]: unknown;
};

export async function uploadProfileAvatar(params: {
  backofficeToken: string;
  uri: string;
  fileName?: string;
  mimeType?: string;
}): Promise<UploadAvatarResponse> {
  const form = new FormData();
  const name = params.fileName ?? 'avatar.jpg';
  const type = params.mimeType ?? 'image/jpeg';

  // React Native / Expo file object format
  form.append('avatar', {
    uri: params.uri,
    name,
    type,
  } as any);

  // NOTE: We do not use fetchJson() here because it forces Accept JSON + tries to parse text,
  // but we need multipart/form-data without manually setting boundary.
  const res = await fetch(`${BASE_URL}/avatar`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${params.backofficeToken}`,
    },
    body: form,
  });

  const text = await res.text();
  const body = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const message =
      typeof body === 'object' && body && 'message' in body ? (body as any).message : `Request failed (${res.status})`;
    throw new Error(String(message));
  }

  return body as UploadAvatarResponse;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
