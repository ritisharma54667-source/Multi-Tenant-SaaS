// ============================================================
// API CLIENT
// ============================================================
// Central axios instance. Two interceptors:
//   1. Attaches the access token (Authorization: Bearer ...)
//   2. Attaches X-Tenant-Id for the CURRENTLY SELECTED tenant
//
// Remember: the backend re-verifies this tenant via the
// memberships table on every request — this header is a
// REQUEST, not a guarantee. See backend/src/middleware/tenantContext.js
// ============================================================

import axios from 'axios';
import { PROJECT_CONFIG } from '../config/projectConfig.js';
import { useAuthStore } from '../store/authStore.js';
import { useTenantStore } from '../store/tenantStore.js';

export const apiClient = axios.create({
  baseURL: PROJECT_CONFIG.apiBaseUrl,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  const { currentTenantId } = useTenantStore.getState();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (currentTenantId) {
    config.headers['X-Tenant-Id'] = currentTenantId;
  }
  return config;
});

// Response interceptor: on 401, try ONE silent refresh using the
// refresh token, then retry the original request. If refresh also
// fails, log the user out — don't loop forever.
let isRefreshing = false;
let pendingQueue = [];

function flushQueue(error, token) {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  pendingQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const { refreshToken, setAccessToken, logout } = useAuthStore.getState();
    if (!refreshToken) {
      logout();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until the in-flight refresh finishes
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(`${PROJECT_CONFIG.apiBaseUrl}/auth/refresh`, {
        refreshToken,
      });
      setAccessToken(data.accessToken);
      flushQueue(null, data.accessToken);
      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      flushQueue(refreshError, null);
      logout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
