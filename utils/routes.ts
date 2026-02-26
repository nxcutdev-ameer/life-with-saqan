import type { Property } from '@/types';
import type { Href } from 'expo-router';

/**
 * Build a route to the property details screen.
 *
 * The details screen fetches by property reference, but likes/saves are keyed by the public video id.
 * When we have both, we pass `videoId` so engagement stays consistent across feed and details.
 */
export function buildPropertyDetailsRoute(input: {
  propertyReference?: string | null;
  id?: string | null;
  mode?: 'ready' | 'offplan' | string | null;
  agentPhone?: string | null;
}): Href {  
  // Using an object Href keeps expo-router types happy (avoids pushing arbitrary strings).

  const ref = (input.propertyReference || input.id || '').trim();
  if (!ref) {
    return { pathname: '/property/[id]', params: { id: '' } } as unknown as Href;
  }

  const videoId = (input.id || '').trim();

  const mode = (input.mode || '').trim();
  const modeParams = mode ? { mode } : {};

  const agentPhone = (input.agentPhone || '').trim();
  const agentPhoneParams = agentPhone ? { agentPhone } : {};

  if (videoId && videoId !== ref) {
    return {
      pathname: '/property/[id]',
      params: { id: ref, videoId, ...modeParams, ...agentPhoneParams },
    } as unknown as Href;
  }

  return {
    pathname: '/property/[id]',
    params: { id: ref, ...modeParams, ...agentPhoneParams },
  } as unknown as Href;
}
