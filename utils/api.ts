export class ApiError extends Error {
  status?: number;
  body?: unknown;

  constructor(message: string, options?: { status?: number; body?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = options?.status;
    this.body = options?.body;
  }
}

export async function fetchJson<T>(
  url: string,
  options?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? 15000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options?.headers ?? {}),
      },
    });

    const text = await res.text();
    const body = text ? safeJsonParse(text) : null;

    if (!res.ok) {
      const messageFromBody =
        typeof body === 'object' && body && 'message' in body ? (body as any).message : undefined;
      throw new ApiError(messageFromBody || `Request failed (${res.status})`, {
        status: res.status,
        body,
      });
    }

    return body as T;
  } catch (err: any) {
    // RN fetch throws AbortError on timeout via AbortController.
    if (err?.name === 'AbortError') {
      throw new ApiError('Request timed out. Please check your connection and try again.', {
        status: 0,
      });
    }

    // RN fetch commonly throws TypeError('Network request failed') for connectivity/DNS/SSL issues.
    if (err instanceof TypeError) {
      throw new ApiError('Network request failed. Please check your internet connection.', {
        status: 0,
      });
    }

    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
