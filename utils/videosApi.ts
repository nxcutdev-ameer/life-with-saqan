import { fetchJson } from '@/utils/api';

const BASE_URL = 'https://www.saqan.com/api/videos';

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
  onProgress?: (progress: number) => void;
}): Promise<UploadWithPropertySuccessResponse> {
  return new Promise((resolve, reject) => {
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

    console.log('[UploadWithProperty] Starting upload...');
    const xhr = new XMLHttpRequest();
    console.log('[UploadWithProperty] XHR created. Upload support:', !!xhr.upload);
    
    xhr.open('POST', `${BASE_URL}/upload-with-property`);
    xhr.setRequestHeader('Authorization', `Bearer ${params.saqancomToken}`);
    xhr.setRequestHeader('Accept', 'application/json');
    // Note: Do NOT set Content-Type for FormData; XMLHttpRequest will add boundary.

    if (xhr.upload && params.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          params.onProgress!(event.loaded / event.total);
        }
      };
    }

    xhr.onload = () => {
      console.log('[UploadWithProperty] xhr.onload', xhr.status);
      let body: any;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = xhr.responseText;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
      } else {
        reject({
          status: xhr.status,
          message: body?.message || 'Upload failed',
          body,
        });
      }
    };

    xhr.onerror = (e) => {
      console.log('[UploadWithProperty] xhr.onerror', e);
      reject({ message: 'Network request failed' });
    };

    xhr.ontimeout = () => {
      console.log('[UploadWithProperty] xhr.ontimeout');
      reject({ message: 'Request timed out' });
    };

    console.log('[UploadWithProperty] Sending request...');
    xhr.send(form);
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
  onProgress?: (progress: number) => void;
}): Promise<UploadWithPropertySuccessResponse> {
  return new Promise((resolve, reject) => {
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

    console.log('[UploadGeneric] Starting upload...');
    const xhr = new XMLHttpRequest();
    console.log('[UploadGeneric] XHR created. Upload support:', !!xhr.upload);

    xhr.open('POST', `${BASE_URL}/upload-generic`);
    xhr.setRequestHeader('Authorization', `Bearer ${params.saqancomToken}`);
    xhr.setRequestHeader('Accept', 'application/json');

    if (xhr.upload && params.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          params.onProgress!(event.loaded / event.total);
        }
      };
    }

    xhr.onload = () => {
      console.log('[UploadGeneric] xhr.onload', xhr.status);
      let body: any;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = xhr.responseText;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
      } else {
        reject({
          status: xhr.status,
          message: body?.message || 'Upload failed',
          body,
        });
      }
    };

    xhr.onerror = (e) => {
      console.log('[UploadGeneric] xhr.onerror', e);
      reject({ message: 'Network request failed' });
    };

    xhr.ontimeout = () => {
      console.log('[UploadGeneric] xhr.ontimeout');
      reject({ message: 'Request timed out' });
    };

    console.log('[UploadGeneric] Sending request...');
    xhr.send(form);
  });
}
