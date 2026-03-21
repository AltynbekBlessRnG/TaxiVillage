import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  clearAuth,
  loadAuth,
  updateAuthTokens,
} from '../storage/authStorage';
import { stopDriverBackgroundTracking } from '../location/backgroundTracking';

const BASE_URL = 'http://192.168.0.11:3000/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'ngrok-skip-browser-warning': 'true',
  },
});

let refreshPromise: Promise<string | null> | null = null;

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (config.headers.Authorization) {
      return config;
    }

    const auth = await loadAuth();
    if (auth?.accessToken) {
      config.headers.Authorization = `Bearer ${auth.accessToken}`;
    }

    return config;
  },
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const nextAccessToken = await refreshAccessToken();
    if (!nextAccessToken) {
      await clearAuth();
      delete apiClient.defaults.headers.common.Authorization;
      return Promise.reject(error);
    }

    originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
    return apiClient(originalRequest);
  },
);

export function setAuthToken(token: string | null): void {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // Ignore logout failures and clear the local session anyway.
  } finally {
    await stopDriverBackgroundTracking().catch(() => {});
    await clearAuth();
    setAuthToken(null);
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const auth = await loadAuth();
      if (!auth?.refreshToken) {
        return null;
      }

      try {
        const response = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken: auth.refreshToken,
        });
        const { accessToken, refreshToken } = response.data as {
          accessToken: string;
          refreshToken: string;
        };
        await updateAuthTokens({ accessToken, refreshToken });
        setAuthToken(accessToken);
        return accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}
