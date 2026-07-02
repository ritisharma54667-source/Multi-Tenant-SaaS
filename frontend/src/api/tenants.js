// ============================================================
// TENANTS API — workspace-level actions
// ============================================================
// Note: creating a workspace (createTenant) lives in api/auth.js
// from earlier phases — left there to avoid churn. This file is
// for the Phase 8 addition (deleting a workspace) plus anywhere
// else workspace-scoped-but-not-CRM actions land later.
// ============================================================
import { apiClient } from './client.js';

export const deleteWorkspace = (confirmName) =>
  apiClient.delete('/tenants/current', { data: { confirmName } }).then((r) => r.data);
