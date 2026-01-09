import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AuthFlow = 'login' | 'register';

export interface AuthState {
  isAuthenticated: boolean;
  phoneNumber: string | null;
  pendingPhoneNumber: string | null;
  pendingFlow: AuthFlow | null;

  setPendingAuth: (params: { phoneNumber: string; flow: AuthFlow }) => void;
  clearPendingAuth: () => void;

  /**
   * Frontend-only stub: mark user as authenticated.
   * In a real app this would be done after verifying OTP with backend.
   */
  completeOtpVerification: () => void;

  logout: () => void;
}

const STORAGE_KEY = '@saqan_auth';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      phoneNumber: null,
      pendingPhoneNumber: null,
      pendingFlow: null,

      setPendingAuth: ({ phoneNumber, flow }) => {
        const normalized = phoneNumber.replace(/\s+/g, '');
        set({ pendingPhoneNumber: normalized, pendingFlow: flow });
      },

      clearPendingAuth: () => set({ pendingPhoneNumber: null, pendingFlow: null }),

      completeOtpVerification: () => {
        const pending = get().pendingPhoneNumber;
        set({
          isAuthenticated: true,
          phoneNumber: pending ?? get().phoneNumber,
          pendingPhoneNumber: null,
          pendingFlow: null,
        });
      },

      logout: () =>
        set({
          isAuthenticated: false,
          phoneNumber: null,
          pendingPhoneNumber: null,
          pendingFlow: null,
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist what we need across app restarts.
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        phoneNumber: state.phoneNumber,
      }),
    }
  )
);
