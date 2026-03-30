import { Socket } from 'socket.io-client';
import { loadAuth } from '../storage/authStorage';
import { createAppSocket } from './appSocket';

export interface IntercityMessage {
  id: string;
  content: string;
  senderId: string;
  senderType: 'PASSENGER' | 'DRIVER';
  receiverId: string;
  receiverType: 'PASSENGER' | 'DRIVER';
  createdAt: string;
  readAt?: string | null;
  senderName?: string;
  receiverName?: string;
}

export class IntercityChatSocket {
  private socket: Socket | null = null;
  private messageCallback?: (message: IntercityMessage) => void;
  private errorCallback?: (error: any) => void;

  async connect(threadType: 'ORDER' | 'BOOKING', threadId: string): Promise<void> {
    const auth = await loadAuth();
    if (!auth?.accessToken) {
      throw new Error('No auth token found');
    }

    this.socket = createAppSocket(auth.accessToken) as unknown as Socket;

    return new Promise((resolve, reject) => {
      const handleConnect = () => {
        this.socket?.emit('join:intercity-thread', { threadType, threadId });
        resolve();
      };

      const handleConnectError = (error: any) => {
        reject(error);
      };

      this.socket?.once('connect', handleConnect);
      this.socket?.once('connect_error', handleConnectError);
    });
  }

  disconnect(): void {
    if (!this.socket) {
      return;
    }
    if (this.messageCallback) {
      this.socket.off('intercity-message:sent', this.messageCallback);
    }
    if (this.errorCallback) {
      this.socket.off('error', this.errorCallback);
    }
    this.socket.disconnect();
    this.socket = null;
    this.messageCallback = undefined;
    this.errorCallback = undefined;
  }

  onMessage(callback: (message: IntercityMessage) => void): void {
    if (!this.socket) {
      throw new Error('Intercity chat socket not connected');
    }
    if (this.messageCallback) {
      this.socket.off('intercity-message:sent', this.messageCallback);
    }
    this.messageCallback = callback;
    this.socket.on('intercity-message:sent', callback);
  }

  onError(callback: (error: any) => void): void {
    if (!this.socket) {
      throw new Error('Intercity chat socket not connected');
    }
    if (this.errorCallback) {
      this.socket.off('error', this.errorCallback);
    }
    this.errorCallback = callback;
    this.socket.on('error', callback);
  }
}

export const createIntercityChatSocket = () => new IntercityChatSocket();
