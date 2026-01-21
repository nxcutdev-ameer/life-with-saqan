import { create } from 'zustand';

export type UiLockState = {
  uploadLocked: boolean;
  setUploadLocked: (locked: boolean) => void;
};

export const useUiLockStore = create<UiLockState>((set) => ({
  uploadLocked: false,
  setUploadLocked: (locked) => set({ uploadLocked: locked }),
}));
