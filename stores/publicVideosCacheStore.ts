import { create } from 'zustand';
import type { PublicVideo } from '@/utils/publicVideosApi';
import { fetchPublicVideos } from '@/utils/publicVideosApi';

type PublicVideosCacheState = {
  page1: PublicVideo[] | null;
  loadedAt: number | null;
  inFlight: Promise<PublicVideo[]> | null;
  setPage1: (videos: PublicVideo[]) => void;
  clear: () => void;
  warmPage1: (opts?: { perPage?: number; force?: boolean }) => Promise<PublicVideo[]>;
};

export const usePublicVideosCacheStore = create<PublicVideosCacheState>((set, get) => ({
  page1: null,
  loadedAt: null,
  inFlight: null,
  setPage1: (videos) => set({ page1: videos, loadedAt: Date.now() }),
  clear: () => set({ page1: null, loadedAt: null, inFlight: null }),
  warmPage1: async (opts) => {
    const perPage = opts?.perPage ?? 50;
    const force = opts?.force ?? false;

    const cached = get().page1;
    if (!force && cached && cached.length) {
      return cached;
    }

    const existing = get().inFlight;
    if (existing) return existing;

    const p = (async () => {
      try {
        const res = await fetchPublicVideos({ page: 1, perPage });
        const videos = res?.data ?? [];
        set({ page1: videos, loadedAt: Date.now() });
        return videos;
      } finally {
        // Always clear inFlight even if request fails.
        set({ inFlight: null });
      }
    })();

    set({ inFlight: p });
    return p;
  },
}));

// Convenience function so screens can warm without importing Zustand hooks.
export async function warmPublicVideosPage1(opts?: { perPage?: number; force?: boolean }) {
  return usePublicVideosCacheStore.getState().warmPage1(opts);
}
