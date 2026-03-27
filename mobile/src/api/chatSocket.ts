import { io, Socket } from 'socket.io-client';
import { loadAuth } from '../storage/authStorage';
import { BASE_URL } from './instance';

export interface Message {
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

export class ChatSocket {
  private socket: Socket | null = null;
  private rideId: string | null = null;
  private messageCallback?: (message: Message) => void;
  private errorCallback?: (error: any) => void;

  async connect(rideId: string): Promise<void> {
    const auth = await loadAuth();
    if (!auth?.accessToken) {
      throw new Error('No auth token found');
    }

    this.rideId = rideId;
    const wsBase = BASE_URL.replace('/api', '');
    this.socket = io(`${wsBase}/chat`, {
      path: '/socket.io',
      auth: { token: auth.accessToken },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    return new Promise((resolve, reject) => {
      const handleConnect = () => {
        console.log('Chat socket connected');
        this.socket!.emit('join:ride', { rideId });
        resolve();
      };

      const handleConnectError = (error: any) => {
        console.error('Chat socket connection error:', error);
        reject(error);
      };

      this.socket!.once('connect', handleConnect);
      this.socket!.once('connect_error', handleConnectError);
    });
  }

  disconnect(): void {
    if (this.socket) {
      if (this.messageCallback) {
        this.socket.off('message:sent', this.messageCallback);
      }
      if (this.errorCallback) {
        this.socket.off('error', this.errorCallback);
      }
      this.socket.disconnect();
      this.socket = null;
      this.rideId = null;
      this.messageCallback = undefined;
      this.errorCallback = undefined;
    }
  }

  sendMessage(content: string, receiverType: 'PASSENGER' | 'DRIVER'): void {
    if (!this.socket || !this.rideId) {
      throw new Error('Chat socket not connected');
    }

    this.socket.emit('send:message', {
      content,
      receiverType,
    });
  }

  onMessage(callback: (message: Message) => void): void {
    if (!this.socket) {
      throw new Error('Chat socket not connected');
    }

    if (this.messageCallback) {
      this.socket.off('message:sent', this.messageCallback);
    }
    this.messageCallback = callback;
    this.socket.on('message:sent', callback);
  }

  onError(callback: (error: any) => void): void {
    if (!this.socket) {
      throw new Error('Chat socket not connected');
    }

    if (this.errorCallback) {
      this.socket.off('error', this.errorCallback);
    }
    this.errorCallback = callback;
    this.socket.on('error', callback);
  }
}

export const createChatSocket = () => new ChatSocket();
