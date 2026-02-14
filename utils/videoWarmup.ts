/**
 * Best-effort warm up for remote video URLs.
 *
 * In TestFlight / production builds, the first ever playback can be delayed by DNS/TLS handshake
 * and initial buffering. We can't fully cache videos without expo-file-system, but we can
 * warm up the connection by issuing a small range request.
 */
export async function warmUpVideoUrls(urls: string[], opts?: { bytes?: number; timeoutMs?: number }) {
  const bytes = opts?.bytes ?? 512 * 1024; // 512KB
  const timeoutMs = opts?.timeoutMs ?? 8000;

  await Promise.all(
    urls
      .filter(Boolean)
      .slice(0, 3)
      .map(async (url) => {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        try {
          // Try a small range request (works for MP4, sometimes ignored for HLS manifests).
          await fetch(url, {
            method: 'GET',
            headers: {
              Range: `bytes=0-${bytes - 1}`,
              Accept: '*/*',
            },
            signal: controller.signal,
          });
        } catch {
          // Ignore warmup failures; playback will still work normally.
        } finally {
          clearTimeout(t);
        }
      })
  );
}
