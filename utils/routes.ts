import type { Property } from '@/types';

/**
 * Build a route to the property details screen.
 *
 * The details screen fetches by property reference, but likes/saves are keyed by the public video id.
 * When we have both, we pass `videoId` so engagement stays consistent across feed and details.
 */
export function buildPropertyDetailsRoute(input: {
  propertyReference?: string | null;
  id?: string | null;
}): string {
  const ref = (input.propertyReference || input.id || '').trim();
  if (!ref) return '/property/';

  const videoId = (input.id || '').trim();

  // Only append videoId when it's meaningfully different from the reference.
  if (videoId && videoId !== ref) {
    return `/property/${encodeURIComponent(ref)}?videoId=${encodeURIComponent(videoId)}`;
  }
  return `/property/${encodeURIComponent(ref)}`;
}
