// ============================================================
// AUTH STORE (Zustand)
// ============================================================
// Holds the current user + access token. Persisted to localStorage
// so a refresh doesn't log the user out (the access token is
// short-lived anyway, so this is low-risk — full refresh-token
// rotation flow is wired in Phase 2).
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null, // { id, name, email }
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setSession: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      setAccessToken: (accessToken) => set({ accessToken }),

      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    }),
    { name: 'auth-storage' }
  )
);
