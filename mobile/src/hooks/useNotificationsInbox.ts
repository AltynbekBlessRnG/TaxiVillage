import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearReadNotifications,
  AppNotificationItem,
  loadNotificationsInbox,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeNotificationsInbox,
} from '../storage/notificationsInbox';

export function useNotificationsInbox() {
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);

  const refresh = useCallback(async () => {
    const items = await loadNotificationsInbox();
    setNotifications(items);
    return items;
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
    const unsubscribe = subscribeNotificationsInbox((items) => {
      setNotifications(items);
    });

    return unsubscribe;
  }, [refresh]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.readAt).length,
    [notifications],
  );

  const markRead = useCallback(async (notificationId: string) => {
    const items = await markNotificationAsRead(notificationId);
    setNotifications(items);
    return items;
  }, []);

  const markAllRead = useCallback(async () => {
    const items = await markAllNotificationsAsRead();
    setNotifications(items);
    return items;
  }, []);

  const clearRead = useCallback(async () => {
    const items = await clearReadNotifications();
    setNotifications(items);
    return items;
  }, []);

  return {
    notifications,
    unreadCount,
    refresh,
    markRead,
    markAllRead,
    clearRead,
  };
}
