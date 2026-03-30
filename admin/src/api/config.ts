const envApiUrl = import.meta.env.VITE_API_URL?.trim();

if (!envApiUrl) {
  console.warn('VITE_API_URL is not set. Admin API requests may fail until you add it to admin/.env');
}

export const API_URL = envApiUrl || '';
