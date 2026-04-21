import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { Socket } from 'socket.io-client';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createIntercitySocket } from '../../api/intercitySocket';
import { InlineLabel, PrimaryButton, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';
import { DarkAlertModal } from '../../components/DarkAlertModal';
import { formatIntercityDateTime } from '../../constants/intercity';
import { loadAuth } from '../../storage/authStorage';
import { useThreadUnread } from '../../hooks/useThreadUnread';
import { saveNotificationToInbox } from '../../storage/notificationsInbox';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityOrderStatus'>;

const statusLabels: Record<string, string> = {
  SEARCHING_DRIVER: 'Ищем водителя',
  CONFIRMED: 'Водитель найден',
  DRIVER_EN_ROUTE: 'Водитель выехал',
  BOARDING: 'Посадка',
  IN_PROGRESS: 'В пути',
  COMPLETED: 'Завершено',
  CANCELED: 'Отменено',
};

export const IntercityOrderStatusScreen: React.FC<Props> = ({ navigation, route }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [modal, setModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: '',
  });
  const { intercityUnreadByThread, refresh: refreshThreadUnread } = useThreadUnread({ autoRefresh: false });
  const knownInviteIdsRef = useRef<Set<string>>(new Set());
  const lastStatusRef = useRef<string | null>(null);

  const loadOrder = useCallback(() => {
    return apiClient
      .get(`/intercity-orders/${route.params.orderId}`)
      .then((response) => setOrder(response.data))
      .finally(() => setLoading(false));
  }, [route.params.orderId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      refreshThreadUnread().catch(() => null);
      loadOrder().catch(() => null);
      return undefined;
    }, [loadOrder, refreshThreadUnread]),
  );

  useEffect(() => {
    let isMounted = true;
    let socket: Socket | null = null;

    const setupSocket = async () => {
      const auth = await loadAuth();
      if (!auth?.accessToken || !isMounted) {
        return;
      }

      socket = createIntercitySocket(auth.accessToken);
      socket.on('connect', () => {
        socket?.emit('join:intercity-order', { orderId: route.params.orderId });
      });
      socket.on('intercity-order:updated', (nextOrder: any) => {
        if (!isMounted || nextOrder?.id !== route.params.orderId) {
          return;
        }
        setOrder(nextOrder);
        setLoading(false);
      });
    };

    setupSocket().catch(() => null);

    return () => {
      isMounted = false;
      socket?.disconnect();
    };
  }, [route.params.orderId]);

  useEffect(() => {
    if (!order?.id) {
      return;
    }

    const currentStatus = typeof order.status === 'string' ? order.status : null;
    if (currentStatus && lastStatusRef.current && lastStatusRef.current !== currentStatus) {
      void saveNotificationToInbox({
        id: `intercity-order-status:${order.id}:${currentStatus}`,
        title: 'Статус межгорода',
        body: `Заявка: ${statusLabels[currentStatus] || currentStatus}`,
        data: { type: 'INTERCITY_ORDER_STATUS', orderId: order.id },
        source: 'local',
      });
    }
    if (currentStatus) {
      lastStatusRef.current = currentStatus;
    }

    const invites = Array.isArray(order.invites) ? order.invites : [];
    for (const invite of invites) {
      const inviteId = typeof invite?.id === 'string' ? invite.id : null;
      if (!inviteId || knownInviteIdsRef.current.has(inviteId)) {
        continue;
      }
      knownInviteIdsRef.current.add(inviteId);
      if (invite.status === 'PENDING') {
        const routeText = `${invite?.trip?.fromCity || '-'} -> ${invite?.trip?.toCity || '-'}`;
        void saveNotificationToInbox({
          id: `intercity-trip-invite:${inviteId}`,
          title: 'Приглашение в рейс',
          body: `${invite?.trip?.driver?.fullName || 'Водитель'} приглашает: ${routeText}`,
          data: { type: 'INTERCITY_TRIP_INVITE', orderId: order.id, inviteId },
          source: 'local',
        });
      }
    }
  }, [order]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  const canCancel = ['SEARCHING_DRIVER', 'CONFIRMED', 'DRIVER_EN_ROUTE'].includes(order?.status);
  const pendingInvite = Array.isArray(order?.invites)
    ? order.invites.find((invite: any) => invite.status === 'PENDING')
    : null;

  const cancelOrder = async () => {
    try {
      setCancelling(true);
      await apiClient.post(`/intercity-orders/${route.params.orderId}/cancel`);
      await loadOrder();
      navigation.navigate('PassengerHome', {});
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось отменить заявку';
      setModal({
        visible: true,
        title: 'Ошибка',
        message: Array.isArray(message) ? message.join(', ') : message,
      });
    } finally {
      setCancelling(false);
    }
  };

  const acceptInvite = async (inviteId: string) => {
    try {
      const response = await apiClient.post(`/intercity-trips/invites/${inviteId}/accept`);
      navigation.replace('IntercityTripStatus', { bookingId: response.data.id });
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось принять приглашение';
      setModal({
        visible: true,
        title: 'Ошибка',
        message: Array.isArray(message) ? message.join(', ') : message,
      });
    }
  };

  const declineInvite = async (inviteId: string) => {
    try {
      await apiClient.post(`/intercity-trips/invites/${inviteId}/decline`);
      await loadOrder();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось отклонить приглашение';
      setModal({
        visible: true,
        title: 'Ошибка',
        message: Array.isArray(message) ? message.join(', ') : message,
      });
    }
  };

  return (
    <ServiceScreen
      accentColor="#38BDF8"
      title="Моя заявка"
      subtitle=""
      backLabel="На главную"
      onBack={() => navigation.navigate('PassengerHome', {})}
    >
      <ServiceCard>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{statusLabels[order?.status] || 'Межгород'}</Text>
        </View>
        <InlineLabel label="Маршрут" value={`${order?.fromCity || '-'} → ${order?.toCity || '-'}`} />
        <InlineLabel label="Выезд" value={formatIntercityDateTime(order?.departureAt)} />
        <InlineLabel label="Мест" value={String(order?.seats || 1)} />
        <InlineLabel label="Цена" value={`${Math.round(Number(order?.price || 0))} тг`} accentColor="#38BDF8" />
        {order?.baggage ? <InlineLabel label="Багаж" value={order.baggage} /> : null}
        {order?.comment ? <InlineLabel label="Комментарий" value={order.comment} /> : null}
      </ServiceCard>

      {order?.driver ? (
        <ServiceCard compact>
          <InlineLabel label="Водитель" value={order.driver.fullName || order.driver.user?.phone || 'Водитель'} />
          <InlineLabel
            label="Авто"
            value={
              [order.driver.car?.make, order.driver.car?.model, order.driver.car?.color].filter(Boolean).join(' • ') ||
              'Авто не указано'
            }
          />
          <InlineLabel label="Номер" value={order.driver.car?.plateNumber || '-'} />
        </ServiceCard>
      ) : null}

      {pendingInvite ? (
        <ServiceCard compact>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Приглашение в рейс</Text>
          </View>
          <InlineLabel
            label="Рейс"
            value={`${pendingInvite.trip?.fromCity || '-'} → ${pendingInvite.trip?.toCity || '-'}`}
          />
          <InlineLabel label="Выезд" value={formatIntercityDateTime(pendingInvite.trip?.departureAt)} />
          <InlineLabel
            label="Водитель"
            value={pendingInvite.trip?.driver?.fullName || pendingInvite.trip?.driver?.user?.phone || 'Водитель'}
          />
          <InlineLabel
            label="Авто"
            value={
              [pendingInvite.trip?.driver?.car?.make, pendingInvite.trip?.driver?.car?.model, pendingInvite.trip?.driver?.car?.color]
                .filter(Boolean)
                .join(' • ') || 'Авто не указано'
            }
          />
          <InlineLabel label="Цена" value={`${Math.round(Number(pendingInvite.priceOffered || 0))} тг`} accentColor="#38BDF8" />
          <PrimaryButton title="Принять место в рейсе" onPress={() => acceptInvite(pendingInvite.id).catch(() => null)} />
          <PrimaryButton title="Не подходит" onPress={() => declineInvite(pendingInvite.id).catch(() => null)} />
        </ServiceCard>
      ) : null}

      {order?.driver ? (
        <PrimaryButton
          title={
            (intercityUnreadByThread[`ORDER:${order.id}`] ?? 0) > 0
              ? `Чат с водителем (${Math.min(intercityUnreadByThread[`ORDER:${order.id}`], 99)})`
              : 'Чат с водителем'
          }
          onPress={() =>
            navigation.navigate('IntercityChat', {
              threadType: 'ORDER',
              threadId: order.id,
              title: 'Чат по заявке',
            })
          }
        />
      ) : null}
      {canCancel ? (
        <PrimaryButton
          title={cancelling ? 'Отменяем...' : 'Отменить заявку'}
          onPress={() => cancelOrder().catch(() => null)}
        />
      ) : null}
      <PrimaryButton title="К такси" onPress={() => navigation.navigate('PassengerHome', {})} />
      <DarkAlertModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        primaryLabel="Понятно"
        onPrimary={() => setModal({ visible: false, title: '', message: '' })}
      />
    </ServiceScreen>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090B',
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: '#082F49',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 12,
  },
  pillText: {
    color: '#7DD3FC',
    fontWeight: '800',
  },
});
