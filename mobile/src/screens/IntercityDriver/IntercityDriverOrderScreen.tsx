import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { Socket } from 'socket.io-client';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createIntercitySocket } from '../../api/intercitySocket';
import { DarkAlertModal } from '../../components/DarkAlertModal';
import { InlineLabel, PrimaryButton, SecondaryButton, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';
import { formatIntercityDateTime } from '../../constants/intercity';
import { loadAuth } from '../../storage/authStorage';
import { useThreadUnread } from '../../hooks/useThreadUnread';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityDriverOrder'>;

const statusLabels: Record<string, string> = {
  SEARCHING_DRIVER: 'Ищем водителя',
  CONFIRMED: 'Подтверждено',
  DRIVER_EN_ROUTE: 'Водитель выехал',
  BOARDING: 'Посадка',
  IN_PROGRESS: 'В пути',
  COMPLETED: 'Завершено',
  CANCELED: 'Отменено',
};

const nextStatusMap: Record<string, { status: string; label: string } | null> = {
  SEARCHING_DRIVER: null,
  CONFIRMED: { status: 'DRIVER_EN_ROUTE', label: 'Выехал к пассажиру' },
  DRIVER_EN_ROUTE: { status: 'BOARDING', label: 'Пассажир на месте' },
  BOARDING: { status: 'IN_PROGRESS', label: 'Начать поездку' },
  IN_PROGRESS: { status: 'COMPLETED', label: 'Завершить поездку' },
  COMPLETED: null,
  CANCELED: null,
};

export const IntercityDriverOrderScreen: React.FC<Props> = ({ navigation, route }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [modal, setModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: '',
  });
  const { intercityUnreadByThread, refresh: refreshUnread } = useThreadUnread({ autoRefresh: false });

  const loadOrder = useCallback(async () => {
    try {
      const response = await apiClient.get(`/intercity-orders/driver/${route.params.orderId}`);
      setOrder(response.data);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось загрузить заявку';
      setModal({
        visible: true,
        title: 'Межгород',
        message: Array.isArray(message) ? message.join(', ') : message,
      });
    } finally {
      setLoading(false);
    }
  }, [route.params.orderId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      refreshUnread().catch(() => null);
      loadOrder().catch(() => null);
      return undefined;
    }, [loadOrder, refreshUnread]),
  );

  useEffect(() => {
    let mounted = true;
    let socket: Socket | null = null;

    const setupSocket = async () => {
      const auth = await loadAuth();
      if (!auth?.accessToken || !mounted) {
        return;
      }
      socket = createIntercitySocket(auth.accessToken);
      socket.on('connect', () => {
        socket?.emit('join:intercity-order', { orderId: route.params.orderId });
      });
      socket.on('intercity-order:updated', (nextOrder: any) => {
        if (!mounted || nextOrder?.id !== route.params.orderId) {
          return;
        }
        setOrder(nextOrder);
        setLoading(false);
      });
    };

    setupSocket().catch(() => null);
    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, [route.params.orderId]);

  const nextAction = nextStatusMap[order?.status];
  const canCancel = ['CONFIRMED', 'DRIVER_EN_ROUTE', 'BOARDING'].includes(order?.status);

  const updateStatus = async () => {
    if (!nextAction) {
      return;
    }
    setProcessing(true);
    try {
      await apiClient.post(`/intercity-orders/${route.params.orderId}/status`, {
        status: nextAction.status,
      });
      await loadOrder();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось обновить статус заявки';
      setModal({
        visible: true,
        title: 'Ошибка',
        message: Array.isArray(message) ? message.join(', ') : message,
      });
    } finally {
      setProcessing(false);
    }
  };

  const cancelOrder = async () => {
    setProcessing(true);
    try {
      await apiClient.post(`/intercity-orders/${route.params.orderId}/driver-cancel`);
      navigation.goBack();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось отменить заявку';
      setModal({
        visible: true,
        title: 'Ошибка',
        message: Array.isArray(message) ? message.join(', ') : message,
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  return (
    <ServiceScreen
      accentColor="#38BDF8"
      title="Заявка пассажира"
      subtitle=""
      backLabel="К заявкам"
      onBack={() => navigation.goBack()}
    >
      <ServiceCard>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{statusLabels[order?.status] || 'Межгород'}</Text>
        </View>
        <InlineLabel label="Маршрут" value={`${order?.fromCity || '-'} → ${order?.toCity || '-'}`} />
        <InlineLabel label="Выезд" value={formatIntercityDateTime(order?.departureAt)} />
        <InlineLabel label="Мест" value={String(order?.seats || 1)} />
        <InlineLabel label="Цена" value={`${Math.round(Number(order?.price || 0))} тг`} accentColor="#38BDF8" />
        {order?.baggage ? <InlineLabel label="Багаж" value={order.baggage} /> : null}
        {order?.comment ? <InlineLabel label="Комментарий" value={order.comment} /> : null}
      </ServiceCard>

      <ServiceCard compact>
        <InlineLabel
          label="Пассажир"
          value={order?.passenger?.fullName || order?.passenger?.user?.phone || 'Пассажир'}
        />
        <InlineLabel label="Телефон" value={order?.passenger?.user?.phone || '-'} />
      </ServiceCard>

      <SecondaryButton
        title={
          (intercityUnreadByThread[`ORDER:${route.params.orderId}`] ?? 0) > 0
            ? `Чат с пассажиром (${Math.min(intercityUnreadByThread[`ORDER:${route.params.orderId}`], 99)})`
            : 'Чат с пассажиром'
        }
        onPress={() =>
          navigation.navigate('IntercityChat', {
            threadType: 'ORDER',
            threadId: route.params.orderId,
            title: 'Чат по заявке',
          })
        }
      />
      {nextAction ? (
        <PrimaryButton
          title={processing ? 'Обновляем...' : nextAction.label}
          onPress={updateStatus}
          accentColor="#38BDF8"
        />
      ) : null}
      {canCancel ? <SecondaryButton title="Отменить" onPress={cancelOrder} /> : null}

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
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#082F49',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  statusPillText: {
    color: '#BAE6FD',
    fontWeight: '800',
  },
});
