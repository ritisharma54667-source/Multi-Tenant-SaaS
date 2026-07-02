// ============================================================
// ANALYTICS API
// ============================================================
import { apiClient } from './client.js';

export const getOverview = () =>
  apiClient.get('/analytics/overview').then((r) => r.data);

// Export returns a raw CSV blob — caller wires it into an
// <a download> link, it isn't rendered anywhere.
export const exportData = (type) =>
  apiClient
    .get('/analytics/export', { params: { type }, responseType: 'blob' })
    .then((r) => r.data);
