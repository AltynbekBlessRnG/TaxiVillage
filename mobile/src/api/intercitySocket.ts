import { Socket } from 'socket.io-client';
import { createAppSocket } from './appSocket';

export function createIntercitySocket(token: string): Socket {
  return createAppSocket(token) as unknown as Socket;
}
