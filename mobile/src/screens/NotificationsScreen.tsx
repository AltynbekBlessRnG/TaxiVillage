import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useNotificationsInbox } from '../hooks/useNotificationsInbox';
import type { AppNotificationItem } from '../storage/notificationsInbox';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;
type NotificationFilter = 'ALL' | 'CHAT' | 'ORDERS';

function getNotificationFilter(item: AppNotificationItem): NotificationFilter {
  const type = typeof item.data.type === 'string' ? item.data.type : null;
  if (type === 'CHAT_MESSAGE' || type === 'INTERCITY_CHAT_MESSAGE') {
    return 'CHAT';
  }
  return 'ORDERS';
}

function getDateSectionLabel(dateValue: string) {
  const date = new Date(dateValue);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return 'Сегодня';
  }

  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
  });
}

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const { notifications, unreadCount, refresh, markRead, markAllRead, clearRead } = useNotificationsInbox();
  const [filter, setFilter] = useState<NotificationFilter>('ALL');

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  const openNotification = async (item: (typeof notifications)[number]) => {
    await markRead(item.id).catch(() => {});

    const type = typeof item.data.type === 'string' ? item.data.type : null;
    const rideId = typeof item.data.rideId === 'string' ? item.data.rideId : null;
    const courierOrderId =
      typeof item.data.courierOrderId === 'string' ? item.data.courierOrderId : null;
    const orderId = typeof item.data.orderId === 'string' ? item.data.orderId : null;
    const threadType =
      item.data.threadType === 'ORDER' || item.data.threadType === 'BOOKING'
        ? item.data.threadType
        : null;
    const threadId = typeof item.data.threadId === 'string' ? item.data.threadId : null;

    if (type === 'CHAT_MESSAGE' && rideId) {
      navigation.navigate('ChatScreen', { rideId });
      return;
    }

    if (type === 'INTERCITY_CHAT_MESSAGE' && threadType && threadId) {
      navigation.navigate('IntercityChat', { threadType, threadId });
      return;
    }

    if (type === 'FOOD_ORDER_STATUS' && orderId) {
      navigation.navigate('FoodOrderStatus', { orderId });
      return;
    }

    if (type === 'FOOD_ORDER_CREATED') {
      navigation.navigate('MerchantOrders');
      return;
    }

    if (courierOrderId || rideId) {
      navigation.navigate('PassengerHome', {});
    }
  };

  const renderItem = ({ item }: { item: (typeof notifications)[number] }) => (
    <TouchableOpacity
      style={styles.item}
      activeOpacity={0.85}
      onPress={() => void openNotification(item)}
    >
      <View style={styles.itemHeader}>
        <View style={styles.titleRow}>
          {!item.readAt ? <View style={styles.unreadDot} /> : null}
          <Text style={styles.itemTitle}>{item.title}</Text>
        </View>
        <Text style={styles.date}>
          {new Date(item.createdAt).toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      <Text style={styles.itemBody}>{item.body || 'Открыть уведомление'}</Text>
    </TouchableOpacity>
  );

  const filteredNotifications = useMemo(() => {
    if (filter === 'ALL') {
      return notifications;
    }

    return notifications.filter((item) => getNotificationFilter(item) === filter);
  }, [filter, notifications]);

  const groupedNotifications = useMemo(() => {
    const groups: Array<{ title: string; items: AppNotificationItem[] }> = [];

    for (const item of filteredNotifications) {
      const title = getDateSectionLabel(item.createdAt);
      const existing = groups.find((group) => group.title === title);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({ title, items: [item] });
      }
    }

    return groups;
  }, [filteredNotifications]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Уведомления</Text>
        <TouchableOpacity
          style={[styles.markAllButton, unreadCount === 0 && styles.markAllButtonDisabled]}
          onPress={() => void markAllRead()}
          disabled={unreadCount === 0}
        >
          <Text style={styles.markAllText}>Прочитать все</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.toolbar}>
        <View style={styles.filtersRow}>
          {[
            { key: 'ALL', label: 'Все' },
            { key: 'CHAT', label: 'Чаты' },
            { key: 'ORDERS', label: 'Заказы' },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
              onPress={() => setFilter(item.key as NotificationFilter)}
            >
              <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.clearReadBtn} onPress={() => void clearRead()}>
          <Text style={styles.clearReadText}>Очистить прочитанное</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {groupedNotifications.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Пока пусто</Text>
            <Text style={styles.emptyText}>
              Новые события по заказам, чатам и еде появятся здесь.
            </Text>
          </View>
        ) : (
          groupedNotifications.map((group) => (
            <View key={group.title}>
              <Text style={styles.sectionTitle}>{group.title}</Text>
              {group.items.map((item) => (
                <View key={item.id}>{renderItem({ item })}</View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 18,
    gap: 10,
  },
  backButton: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButtonText: { color: '#A1A1AA', fontSize: 14, fontWeight: '600' },
  title: {
    flex: 1,
    color: '#F4F4F5',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  markAllButton: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  markAllButtonDisabled: {
    opacity: 0.45,
  },
  markAllText: { color: '#E4E4E7', fontSize: 12, fontWeight: '700' },
  toolbar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: '#27272A',
  },
  filterText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '800',
  },
  filterTextActive: {
    color: '#F4F4F5',
  },
  clearReadBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearReadText: { color: '#A1A1AA', fontSize: 12, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  sectionTitle: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 6,
    marginLeft: 4,
  },
  item: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  itemTitle: { color: '#F4F4F5', fontSize: 15, fontWeight: '800', flexShrink: 1 },
  date: { color: '#71717A', fontSize: 11, fontWeight: '500' },
  itemBody: { color: '#A1A1AA', fontSize: 14, lineHeight: 20 },
  emptyBox: {
    marginTop: 48,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: { color: '#F4F4F5', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyText: { color: '#71717A', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
