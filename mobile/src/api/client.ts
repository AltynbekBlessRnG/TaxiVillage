import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  clearAuth,
  loadAuth,
  updateAuthTokens,
} from '../storage/authStorage';
import { resetNotificationsInbox } from '../storage/notificationsInbox';
import { stopDriverBackgroundTracking } from '../location/backgroundTracking';
import { resetRoot } from '../navigation/rootNavigation';
import { apiClient, BASE_URL } from './instance';

export { apiClient };

/**
 * A refresh either produces a token, or fails in one of two very different
 * ways: the server rejected the token (the session is over), or we never got
 * an answer (it almost certainly is not).
 */
export type RefreshResult =
  | { accessToken: string; sessionExpired?: false }
  | { accessToken: null; sessionExpired: boolean };

let refreshPromise: Promise<RefreshResult> | null = null;

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
      (originalRequest.url?.includes('/auth/') &&
        !originalRequest.url?.includes('/auth/refresh')) ||
      originalRequest.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const result = await refreshAccessToken();
    if (!result.accessToken) {
      if (!result.sessionExpired) {
        // The refresh never reached the server - no signal, or the backend is
        // still coming back up from a deploy. Hand the caller its original
        // failure and keep the session: it is almost certainly still valid.
        return Promise.reject(error);
      }

      // The session is gone for good. Clearing it silently left the person on
      // whatever screen they were on with every button answering "не удалось
      // …" — a driver on shift saw only that the ride would not accept, with
      // no hint that they had been signed out. Send them to the login screen,
      // and stop the background tracking a signed-out driver must not run.
      await resetAuthSession();
      resetRoot('Login', undefined);
      return Promise.reject(error);
    }

    originalRequest.headers.Authorization = `Bearer ${result.accessToken}`;
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
    await resetAuthSession();
  }
}

export async function resetAuthSession(): Promise<void> {
  await stopDriverBackgroundTracking().catch(() => {});
  await resetNotificationsInbox().catch(() => {});
  await clearAuth();
  setAuthToken(null);
}

export async function refreshAccessToken(): Promise<RefreshResult> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const auth = await loadAuth();
      if (!auth?.refreshToken) {
        return { accessToken: null, sessionExpired: true };
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
        return { accessToken };
      } catch (error) {
        // Only the server refusing the refresh token means the session is
        // really over. Treating every failure as a dead session signed people
        // out on a moment of bad signal and on every backend redeploy, and
        // each of those cost them a Telegram code to get back in.
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined;
        return {
          accessToken: null,
          sessionExpired: status === 401 || status === 403,
        };
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}
