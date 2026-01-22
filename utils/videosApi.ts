import { fetchJson } from '@/utils/api';

const BASE_URL = 'https://api.saqan.com/api/videos';

export type UploadWithPropertySuccessResponse = {
  success?: boolean;
  message?: string;
  payload?: unknown;
  data?: any;
};

export type UploadWithPropertyErrorResponse = {
  message?: string;
  errors?: Record<string, string[]>;
};

export type RoomTimestampInput = {
  room: string;
  start_time: number; // seconds
  end_time: number; // seconds
};

export async function uploadVideoWithProperty(params: {
  videoFile: { uri: string; name: string; type: string };
  propertyReference: string;
  roomTimestamps: RoomTimestampInput[];
  uploadToCloudflare?: boolean;
  generateSubtitles?: boolean;
  agentId?: number;
  saqancomToken: string;
}): Promise<UploadWithPropertySuccessResponse> {
  const form = new FormData();

  // @ts-expect-error RN FormData file type
  form.append('video_file', params.videoFile);
  form.append('property_reference', params.propertyReference);
  form.append('upload_to_cloudflare', String(params.uploadToCloudflare ?? true));
  form.append('generate_subtitles', String(params.generateSubtitles ?? true));
  form.append('agent_id', String(params.agentId ?? 1));

  params.roomTimestamps.forEach((item, idx) => {
    form.append(`room_timestamps[${idx}][room]`, item.room);
    form.append(`room_timestamps[${idx}][start_time]`, String(Math.trunc(item.start_time)));
    form.append(`room_timestamps[${idx}][end_time]`, String(item.end_time));
  });

  return fetchJson<UploadWithPropertySuccessResponse>(`${BASE_URL}/upload-with-property`, {
    method: 'POST',
    timeoutMs: 120000,
    headers: {
      Authorization: `Bearer ${params.saqancomToken}`,
    },
    // Do NOT set Content-Type for FormData; RN will add boundary.
    body: form as any,
  });
}

// Generic video upload (no property reference)
export async function uploadGenericVideo(params: {
  videoFile: { uri: string; name: string; type: string };
  roomTimestamps: RoomTimestampInput[];
  uploadToCloudflare?: boolean;
  generateSubtitles?: boolean;
  agentId?: number;
  saqancomToken: string;
}): Promise<UploadWithPropertySuccessResponse> {
  const form = new FormData();

  // @ts-expect-error RN FormData file type
  form.append('video_file', params.videoFile);
  form.append('upload_to_cloudflare', String(params.uploadToCloudflare ?? true));
  form.append('generate_subtitles', String(params.generateSubtitles ?? true));
  form.append('agent_id', String(params.agentId ?? 1));

  params.roomTimestamps.forEach((item, idx) => {
    form.append(`room_timestamps[${idx}][room]`, item.room);
    form.append(`room_timestamps[${idx}][start_time]`, String(Math.trunc(item.start_time)));
    form.append(`room_timestamps[${idx}][end_time]`, String(item.end_time));
  });

  return fetchJson<UploadWithPropertySuccessResponse>(`${BASE_URL}/upload`, {
    method: 'POST',
    timeoutMs: 120000,
    headers: {
      Authorization: `Bearer ${params.saqancomToken}`,
    },
    body: form as any,
  });
}
