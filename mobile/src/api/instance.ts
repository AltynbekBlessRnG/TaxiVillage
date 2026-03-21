import axios from 'axios';

export const BASE_URL = 'http://192.168.0.11:3000/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'ngrok-skip-browser-warning': 'true',
  },
});
