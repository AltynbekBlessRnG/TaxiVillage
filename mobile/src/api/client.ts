import axios from 'axios';

// Для разработки на реальном устройстве/эмуляторе используйте IP вашего компьютера в локальной сети
// Например: http://192.168.1.100:3000/api
// Для Android эмулятора можно использовать: http://10.0.2.2:3000/api
// const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.11:3000/api';
const BASE_URL = 'https://early-bananas-beg.loca.lt/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'ngrok-skip-browser-warning': 'true',
  },
});

export function setAuthToken(token: string | null): void {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
}

