// ============================================================
// TENANT STORE (Zustand)
// ============================================================
// Tracks which tenant/workspace the user currently has active,
// plus the list of tenants they belong to (for the workspace
// switcher built in Phase 2). This is CLIENT-SIDE CONVENIENCE
// state only — the backend independently re-verifies membership
// on every request, this store never grants access by itself.
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useTenantStore = create(
  persist(
    (set) => ({
      currentTenantId: null,
      currentTenantName: null,
      currentRole: null, // owner | admin | manager | member | viewer
      currentPlan: null, // free | pro | enterprise — Phase 7
      memberships: [],   // [{ tenantId, tenantName, role, plan }]

      setCurrentTenant: (tenantId, tenantName, role, plan) =>
        set({ currentTenantId: tenantId, currentTenantName: tenantName, currentRole: role, currentPlan: plan }),

      setMemberships: (memberships) => set({ memberships }),

      // Phase 7: called after a successful plan change so the sidebar/
      // billing page reflect the new plan without a full re-fetch.
      setCurrentPlan: (plan) => set({ currentPlan: plan }),

      switchTenant: (tenantId) => {
        const membership = useTenantStore.getState().memberships.find((m) => m.tenantId === tenantId);
        if (membership) {
          set({
            currentTenantId: membership.tenantId,
            currentTenantName: membership.tenantName,
            currentRole: membership.role,
            currentPlan: membership.plan,
          });
        }
      },

      clearTenant: () =>
        set({ currentTenantId: null, currentTenantName: null, currentRole: null, currentPlan: null, memberships: [] }),
    }),
    { name: 'tenant-storage' }
  )
);
