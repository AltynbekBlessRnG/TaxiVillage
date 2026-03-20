import { io, Socket } from 'socket.io-client';

// ЗАМЕНИ ЭТОТ IP НА СВОЙ (как в client.ts)
const SERVER_IP = '192.168.0.11'; 

const WS_BASE = `http://${SERVER_IP}:3000`;

export function createRidesSocket(token: string): Socket {
  console.log('Попытка подключения к сокетам по адресу:', `${WS_BASE}/rides`);
  return io(`${WS_BASE}/rides`, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket'],
  });
}

export function createChatSocket(token: string): Socket {
  return io(`${WS_BASE}/chat`, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket'],
  });
}
