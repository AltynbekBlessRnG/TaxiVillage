import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const STORAGE_KEY = 'taxivillage_admin_auth';

export interface AdminAuthSession {
  accessToken: string;
  refreshToken: string;
}

let refreshPromise: Promise<string | null> | null = null;

export function loadAdminAuth(): AdminAuthSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AdminAuthSession;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveAdminAuth(session: AdminAuthSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAdminAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

export function createAdminClient(
  getSession: () => AdminAuthSession | null,
  setSession: (session: AdminAuthSession | null) => void,
) {
  const client = axios.create({
    baseURL: API_URL,
  });

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const session = getSession();
    if (session?.accessToken) {
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    }
    return config;
  });

  client.interceptors.response.use(
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
        originalRequest.url?.includes('/auth/refresh')
      ) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      const nextAccessToken = await refreshAdminToken(getSession, setSession);
      if (!nextAccessToken) {
        setSession(null);
        clearAdminAuth();
        return Promise.reject(error);
      }

      originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
      return client(originalRequest);
    },
  );

  return client;
}

async function refreshAdminToken(
  getSession: () => AdminAuthSession | null,
  setSession: (session: AdminAuthSession | null) => void,
) {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const session = getSession();
      if (!session?.refreshToken) {
        return null;
      }

      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken: session.refreshToken,
        });
        const nextSession = response.data as AdminAuthSession;
        saveAdminAuth(nextSession);
        setSession(nextSession);
        return nextSession.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}
