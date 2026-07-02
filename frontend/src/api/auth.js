// ============================================================
// AUTH API
// ============================================================
import { apiClient } from './client.js';

export async function signup({ name, email, password, organizationName }) {
  const { data } = await apiClient.post('/auth/signup', {
    name,
    email,
    password,
    organizationName,
  });
  return data;
}

export async function login({ email, password }) {
  const { data } = await apiClient.post('/auth/login', { email, password });
  return data;
}

export async function fetchMe() {
  const { data } = await apiClient.get('/auth/me');
  return data;
}

export async function createTenant({ name }) {
  const { data } = await apiClient.post('/tenants', { name });
  return data;
}

export async function listTenants() {
  const { data } = await apiClient.get('/tenants');
  return data;
}

export async function forgotPassword(email) {
  const { data } = await apiClient.post('/auth/forgot-password', { email });
  return data;
}

export async function resetPassword({ token, password }) {
  const { data } = await apiClient.post('/auth/reset-password', { token, password });
  return data;
}
