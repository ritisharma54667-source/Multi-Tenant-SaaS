// ============================================================
// AUDIT LOG API
// ============================================================
import { apiClient } from './client.js';

export const getAuditLog = ({ page = 1, limit = 25, action = '', targetType = '' } = {}) => {
  const params = { page, limit };
  if (action) params.action = action;
  if (targetType) params.targetType = targetType;
  return apiClient.get('/audit-log', { params }).then((r) => r.data);
};

export const getAuditActions = () =>
  apiClient.get('/audit-log/actions').then((r) => r.data);
