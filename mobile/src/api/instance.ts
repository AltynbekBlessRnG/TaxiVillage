import axios from 'axios';

const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

if (!envApiUrl) {
  console.warn('EXPO_PUBLIC_API_URL is not set. Mobile API requests may fail until you add it to mobile/.env');
}

export const BASE_URL = envApiUrl || '';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'ngrok-skip-browser-warning': 'true',
  },
});
