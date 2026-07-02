// ============================================================
// CRM API — contacts + deals
// ============================================================
import { apiClient } from './client.js';

// ── Contacts ────────────────────────────────────────────────
export const getContacts = (params = {}) =>
  apiClient.get('/contacts', { params }).then((r) => r.data);

export const getContact = (id) =>
  apiClient.get(`/contacts/${id}`).then((r) => r.data);

export const createContact = (data) =>
  apiClient.post('/contacts', data).then((r) => r.data);

export const updateContact = (id, data) =>
  apiClient.put(`/contacts/${id}`, data).then((r) => r.data);

export const deleteContact = (id) =>
  apiClient.delete(`/contacts/${id}`).then((r) => r.data);

// ── Deals ────────────────────────────────────────────────────
export const getDeals = (params = {}) =>
  apiClient.get('/deals', { params }).then((r) => r.data);

export const getKanban = () =>
  apiClient.get('/deals/kanban').then((r) => r.data);

export const createDeal = (data) =>
  apiClient.post('/deals', data).then((r) => r.data);

export const updateDeal = (id, data) =>
  apiClient.put(`/deals/${id}`, data).then((r) => r.data);

export const moveDealStage = (id, stage) =>
  apiClient.patch(`/deals/${id}/stage`, { stage }).then((r) => r.data);

export const deleteDeal = (id) =>
  apiClient.delete(`/deals/${id}`).then((r) => r.data);
