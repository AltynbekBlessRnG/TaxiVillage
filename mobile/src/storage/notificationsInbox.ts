import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATIONS_INBOX_KEY = 'notifications_inbox_v1';
const NOTIFICATIONS_INBOX_LIMIT = 60;

export interface AppNotificationItem {
  id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
  source: 'push' | 'local';
}

type NotificationsListener = (items: AppNotificationItem[]) => void;

const listeners = new Set<NotificationsListener>();

function notify(items: AppNotificationItem[]) {
  listeners.forEach((listener) => listener(items));
}

function normalizeItems(value: unknown): AppNotificationItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is AppNotificationItem =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as AppNotificationItem).id === 'string',
    )
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
}

export async function loadNotificationsInbox(): Promise<AppNotificationItem[]> {
  const raw = await AsyncStorage.getItem(NOTIFICATIONS_INBOX_KEY);
  if (!raw) {
    return [];
  }

  try {
    return normalizeItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function persistNotificationsInbox(items: AppNotificationItem[]) {
  const normalized = normalizeItems(items).slice(0, NOTIFICATIONS_INBOX_LIMIT);
  await AsyncStorage.setItem(NOTIFICATIONS_INBOX_KEY, JSON.stringify(normalized));
  notify(normalized);
  return normalized;
}

export async function saveNotificationToInbox(
  notification: Omit<AppNotificationItem, 'createdAt' | 'readAt'> &
    Partial<Pick<AppNotificationItem, 'createdAt' | 'readAt'>>,
): Promise<AppNotificationItem[]> {
  const current = await loadNotificationsInbox();
  const existingIndex = current.findIndex((item) => item.id === notification.id);
  const nextItem: AppNotificationItem = {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    data: notification.data ?? {},
    createdAt: notification.createdAt ?? new Date().toISOString(),
    readAt: notification.readAt ?? null,
    source: notification.source,
  };

  if (existingIndex >= 0) {
    current[existingIndex] = {
      ...current[existingIndex],
      ...nextItem,
      readAt: current[existingIndex].readAt ?? nextItem.readAt,
    };
    return persistNotificationsInbox(current);
  }

  return persistNotificationsInbox([nextItem, ...current]);
}

export async function markNotificationAsRead(notificationId: string): Promise<AppNotificationItem[]> {
  const current = await loadNotificationsInbox();
  const next = current.map((item) =>
    item.id === notificationId && !item.readAt
      ? {
          ...item,
          readAt: new Date().toISOString(),
        }
      : item,
  );

  return persistNotificationsInbox(next);
}

export async function markAllNotificationsAsRead(): Promise<AppNotificationItem[]> {
  const current = await loadNotificationsInbox();
  const timestamp = new Date().toISOString();
  const next = current.map((item) => ({
    ...item,
    readAt: item.readAt ?? timestamp,
  }));

  return persistNotificationsInbox(next);
}

export async function clearReadNotifications(): Promise<AppNotificationItem[]> {
  const current = await loadNotificationsInbox();
  const next = current.filter((item) => !item.readAt);
  return persistNotificationsInbox(next);
}

export function subscribeNotificationsInbox(listener: NotificationsListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
