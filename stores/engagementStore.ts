import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { setPublicVideoLike } from '@/utils/publicVideosApi';

const STORAGE_KEY = '@liked_videos_v1';

type EngagementState = {
  likedVideoIds: Set<string>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  isLiked: (videoId: string | number) => boolean;
  toggleLike: (videoId: string | number) => Promise<{ likesCount?: number } | null>;
};

export const useEngagementStore = create<EngagementState>((set, get) => ({
  likedVideoIds: new Set(),
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const ids = JSON.parse(raw);
        if (Array.isArray(ids)) {
          set({ likedVideoIds: new Set(ids.map(String)) });
        }
      }
    } catch {
      // ignore
    } finally {
      set({ hydrated: true });
    }
  },

  isLiked: (videoId) => {
    return get().likedVideoIds.has(String(videoId));
  },

  toggleLike: async (videoId) => {
    const id = String(videoId);
    const wasLiked = get().likedVideoIds.has(id);
    const nextLiked = !wasLiked;

    // optimistic update
    set((state) => {
      const next = new Set(state.likedVideoIds);
      if (nextLiked) next.add(id);
      else next.delete(id);
      return { likedVideoIds: next };
    });

    try {
      const res = await setPublicVideoLike({ videoId: id, liked: nextLiked });
      const likesCount = res?.data?.likes_count;

      // persist
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(get().likedVideoIds))).catch(() => {
        // ignore
      });

      return typeof likesCount === 'number' ? { likesCount } : {};
    } catch (e) {
      // revert
      set((state) => {
        const next = new Set(state.likedVideoIds);
        if (wasLiked) next.add(id);
        else next.delete(id);
        return { likedVideoIds: next };
      });

      // persist reverted state
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(get().likedVideoIds))).catch(() => {
        // ignore
      });

      throw e;
    }
  },
}));
