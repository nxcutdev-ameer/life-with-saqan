import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type SubtitleState = {
  languageCode: string;
  setLanguageCode: (code: string) => void;
  clear: () => void;
};

const STORAGE_KEY = '@subtitle_language_v1';

export const useSubtitleStore = create<SubtitleState>()(
  persist(
    (set) => ({
      languageCode: '',
      setLanguageCode: (code) => set({ languageCode: code }),
      clear: () => set({ languageCode: '' }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ languageCode: state.languageCode }),
    }
  )
);
