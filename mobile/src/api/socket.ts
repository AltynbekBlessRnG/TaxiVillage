import { Socket } from 'socket.io-client';
import { createAppSocket } from './appSocket';

export function createRidesSocket(token: string): Socket {
  return createAppSocket(token) as unknown as Socket;
}

export function createChatSocket(token: string): Socket {
  return createAppSocket(token) as unknown as Socket;
}

export function createCourierOrdersSocket(token: string): Socket {
  return createAppSocket(token) as unknown as Socket;
}

export function createFoodOrdersSocket(token: string): Socket {
  return createAppSocket(token) as unknown as Socket;
}
