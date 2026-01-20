export class ApiError extends Error {
  status?: number;
  body?: unknown;
  validationErrors?: Record<string, string[]>;

  constructor(
    message: string,
    options?: { status?: number; body?: unknown; validationErrors?: Record<string, string[]> }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options?.status;
    this.body = options?.body;
    this.validationErrors = options?.validationErrors;
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

      const errorsFromBody =
        typeof body === 'object' && body && 'errors' in body && typeof (body as any).errors === 'object'
          ? ((body as any).errors as Record<string, string[]>)
          : undefined;

      const details = errorsFromBody ? formatValidationErrors(errorsFromBody) : '';
      const message = `${messageFromBody || `Request failed (${res.status})`}${details ? `\n\n${details}` : ''}`;

      throw new ApiError(message, {
        status: res.status,
        body,
        validationErrors: errorsFromBody,
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

function formatValidationErrors(errors: Record<string, string[]>): string {
  const lines: string[] = [];
  for (const [field, msgs] of Object.entries(errors)) {
    if (!Array.isArray(msgs) || !msgs.length) continue;
    lines.push(`${field}: ${msgs.join(', ')}`);
  }
  return lines.join('\n');
}
