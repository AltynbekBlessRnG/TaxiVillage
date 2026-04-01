import { io, Socket } from 'socket.io-client';
import { BASE_URL } from './instance';
import { refreshAccessToken, resetAuthSession } from './client';
import { resetRoot } from '../navigation/rootNavigation';

const WS_BASE = BASE_URL.replace('/api', '');
const APP_NAMESPACE = '/app';

type Listener = (...args: any[]) => void;

let sharedSocket: Socket | null = null;
let activeToken: string | null = null;
let leaseCount = 0;
let authRecoveryPromise: Promise<boolean> | null = null;

function isAuthError(error: unknown) {
  const payload = error as { message?: string; code?: string } | undefined;
  const text = `${payload?.code ?? ''} ${payload?.message ?? ''}`.toLowerCase();
  return (
    text.includes('unauthorized') ||
    text.includes('jwt') ||
    text.includes('token') ||
    text.includes('auth')
  );
}

async function handleAuthFailure() {
  if (authRecoveryPromise) {
    return authRecoveryPromise;
  }

  authRecoveryPromise = (async () => {
    const nextAccessToken = await refreshAccessToken();
    if (nextAccessToken && sharedSocket) {
      activeToken = nextAccessToken;
      sharedSocket.auth = { token: nextAccessToken };
      sharedSocket.connect();
      return true;
    }

    await resetAuthSession();
    if (sharedSocket) {
      sharedSocket.disconnect();
      sharedSocket = null;
    }
    activeToken = null;
    leaseCount = 0;
    resetRoot('Login', undefined);
    return false;
  })().finally(() => {
    authRecoveryPromise = null;
  });

  return authRecoveryPromise;
}

function ensureSocket(token: string) {
  if (sharedSocket && activeToken !== token) {
    sharedSocket.disconnect();
    sharedSocket = null;
    leaseCount = 0;
  }

  if (!sharedSocket) {
    sharedSocket = io(`${WS_BASE}${APP_NAMESPACE}`, {
      path: '/socket.io',
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
    sharedSocket.on('connect_error', (error) => {
      if (isAuthError(error)) {
        void handleAuthFailure();
      }
    });
    sharedSocket.on('error', (error) => {
      if (isAuthError(error)) {
        void handleAuthFailure();
      }
    });
    activeToken = token;
  } else {
    sharedSocket.auth = { token };
    if (!sharedSocket.connected && !sharedSocket.active) {
      sharedSocket.connect();
    }
    activeToken = token;
  }

  return sharedSocket;
}

class AppSocketLease {
  private readonly socket: Socket;
  readonly io: Socket['io'];
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(token: string) {
    this.socket = ensureSocket(token);
    this.io = this.socket.io;
    leaseCount += 1;
  }

  get connected() {
    return this.socket.connected;
  }

  get active() {
    return this.socket.active;
  }

  get auth() {
    return this.socket.auth;
  }

  set auth(value: Socket['auth']) {
    this.socket.auth = value;
  }

  connect() {
    this.socket.connect();
    return this;
  }

  emit(event: string, ...args: any[]) {
    this.socket.emit(event, ...args);
    return this;
  }

  on(event: string, listener: Listener) {
    this.socket.on(event, listener);
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(event, set);

    if (event === 'connect' && this.socket.connected) {
      setTimeout(() => listener(), 0);
    }

    return this;
  }

  once(event: string, listener: Listener) {
    const wrapped: Listener = (...args: any[]) => {
      this.off(event, wrapped);
      listener(...args);
    };
    return this.on(event, wrapped);
  }

  off(event: string, listener?: Listener) {
    if (!listener) {
      const listeners = this.listeners.get(event);
      listeners?.forEach((current) => this.socket.off(event, current));
      this.listeners.delete(event);
      return this;
    }

    this.socket.off(event, listener);
    const listeners = this.listeners.get(event);
    listeners?.delete(listener);
    if (listeners && listeners.size === 0) {
      this.listeners.delete(event);
    }
    return this;
  }

  disconnect() {
    for (const [event, listeners] of this.listeners.entries()) {
      listeners.forEach((listener) => this.socket.off(event, listener));
    }
    this.listeners.clear();

    leaseCount = Math.max(0, leaseCount - 1);
    if (leaseCount === 0) {
      this.socket.disconnect();
      sharedSocket = null;
      activeToken = null;
    }
  }
}

export function createAppSocket(token: string) {
  return new AppSocketLease(token);
}
