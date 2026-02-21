import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = '@liked_properties_v1';

type PropertyLikeState = {
  likedPropertyRefs: Set<string>;
  hydrated: boolean;
  hydrate: () => Promise<void>;

  isLiked: (propertyReference: string | number) => boolean;
  toggleLike: (propertyReference: string | number) => Promise<void>;
};

/**
 * Fallback likes store keyed by `propertyReference`.
 *
 * Why this exists:
 * - Primary likes are keyed by public `videoId` and synced via `/videos/:id/like`.
 * - Some app entry points can open a property details screen without a video id.
 *   In that case we still want a persistent local "liked" UX.
 */
export const usePropertyLikeStore = create<PropertyLikeState>((set, get) => ({
  likedPropertyRefs: new Set(),
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const refs = JSON.parse(raw);
        if (Array.isArray(refs)) {
          set({ likedPropertyRefs: new Set(refs.map(String)) });
        }
      }
    } catch {
      // ignore
    } finally {
      set({ hydrated: true });
    }
  },

  isLiked: (propertyReference) => {
    return get().likedPropertyRefs.has(String(propertyReference));
  },

  toggleLike: async (propertyReference) => {
    const ref = String(propertyReference);
    const wasLiked = get().likedPropertyRefs.has(ref);
    const nextLiked = !wasLiked;

    set((state) => {
      const next = new Set(state.likedPropertyRefs);
      if (nextLiked) next.add(ref);
      else next.delete(ref);
      return { likedPropertyRefs: next };
    });

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(get().likedPropertyRefs))).catch(() => {
      // ignore
    });
  },
}));
