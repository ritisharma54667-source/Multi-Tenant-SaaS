// ============================================================
// APP CONTEXT
// ============================================================
// This is the Context API layer requested for the project. It
// doesn't duplicate state (Zustand stores remain the source of
// truth and persist independently) — instead it COMPOSES all
// project-wide details into one place so any component can do:
//
//   const { user, tenant, role, theme, project } = useApp();
//
// instead of importing five different stores. It exposes:
//   - user            (from authStore)
//   - tenant info      (from tenantStore)
//   - theme + toggle   (from themeStore)
//   - project          (static metadata from projectConfig.js —
//                       name, stack, phases, design tokens, roles)
//
// Why both Context AND Zustand? Zustand handles state updates
// efficiently (no unnecessary re-renders, persistence built in).
// Context here is just the convenience/aggregation layer on top,
// plus it's where DOM side-effects like toggling the `dark`
// class on <html> live.
// ============================================================

import { createContext, useContext, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { useTenantStore } from '../store/tenantStore.js';
import { useThemeStore } from '../store/themeStore.js';
import { PROJECT_CONFIG } from '../config/projectConfig.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { currentTenantId, currentTenantName, currentRole, currentPlan, memberships } = useTenantStore();
  const { theme, toggleTheme } = useThemeStore();

  // Sync the `dark` class on <html> whenever theme changes —
  // Tailwind's darkMode: 'class' strategy depends on this.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      // --- auth/user ---
      user,
      isAuthenticated,
      logout,

      // --- tenant/workspace ---
      tenant: {
        id: currentTenantId,
        name: currentTenantName,
        role: currentRole,
        plan: currentPlan,
        memberships,
      },

      // --- theme ---
      theme,
      toggleTheme,

      // --- full project metadata (stack, phases, design tokens, roles) ---
      project: PROJECT_CONFIG,
    }),
    [user, isAuthenticated, logout, currentTenantId, currentTenantName, currentRole, currentPlan, memberships, theme, toggleTheme]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp() must be used inside <AppProvider>');
  }
  return ctx;
}
