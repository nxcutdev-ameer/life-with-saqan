import { create } from 'zustand';
import type { VideoPlayer } from 'expo-video';

export type VideoPlayerPoolEntry = {
  key: string;
  url: string;
  player: VideoPlayer;
  createdAt: number;
};

type VideoPlayerPoolState = {
  /** Players keyed by url. Intended only for the first few feed items. */
  byUrl: Record<string, VideoPlayerPoolEntry>;
  upsert: (url: string, player: VideoPlayer) => void;
  get: (url: string) => VideoPlayer | null;
  releaseAll: () => void;
  releaseExcept: (keepUrls: string[]) => void;
};

export const useVideoPlayerPoolStore = create<VideoPlayerPoolState>((set, get) => ({
  byUrl: {},
  upsert: (url, player) => {
    if (!url) return;
    set((st) => ({
      byUrl: {
        ...st.byUrl,
        [url]: {
          key: url,
          url,
          player,
          createdAt: Date.now(),
        },
      },
    }));
  },
  get: (url) => {
    if (!url) return null;
    return get().byUrl[url]?.player ?? null;
  },
  releaseAll: () => {
    const entries = Object.values(get().byUrl);
    for (const e of entries) {
      try {
        e.player.pause();
      } catch {}
      try {
        e.player.release();
      } catch {}
    }
    set({ byUrl: {} });
  },
  releaseExcept: (keepUrls) => {
    const keep = new Set(keepUrls.filter(Boolean));
    const byUrl = get().byUrl;
    for (const url of Object.keys(byUrl)) {
      if (keep.has(url)) continue;
      const p = byUrl[url]?.player;
      if (!p) continue;
      try {
        p.pause();
      } catch {}
      try {
        p.release();
      } catch {}
    }
    set((st) => {
      const next: typeof st.byUrl = {};
      for (const url of keep) {
        if (st.byUrl[url]) next[url] = st.byUrl[url];
      }
      return { byUrl: next };
    });
  },
}));
