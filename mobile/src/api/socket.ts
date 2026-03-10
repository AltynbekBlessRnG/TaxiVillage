import { io, Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
const WS_BASE = API_URL.replace(/\/api\/?$/, '') || 'http://localhost:3000';

export function createRidesSocket(token: string): Socket {
  return io(`${WS_BASE}/rides`, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket'],
  });
}
