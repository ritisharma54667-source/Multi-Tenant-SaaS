// ============================================================
// BILLING API
// ============================================================
import { apiClient } from './client.js';

export const getBilling = () =>
  apiClient.get('/billing').then((r) => r.data);

export const getPlans = () =>
  apiClient.get('/billing/plans').then((r) => r.data);

export const changePlan = (plan) =>
  apiClient.post('/billing/change-plan', { plan }).then((r) => r.data);
