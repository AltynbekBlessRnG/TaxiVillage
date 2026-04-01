import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { Socket } from 'socket.io-client';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createIntercitySocket } from '../../api/intercitySocket';
import { InlineLabel, PrimaryButton, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';
import { loadAuth } from '../../storage/authStorage';
import { useThreadUnread } from '../../hooks/useThreadUnread';

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
  const { intercityUnreadByThread, refresh: refreshThreadUnread } = useThreadUnread({ autoRefresh: false });

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  const canCancel = ['SEARCHING_DRIVER', 'CONFIRMED', 'DRIVER_EN_ROUTE'].includes(order?.status);

  const cancelOrder = async () => {
    try {
      setCancelling(true);
      await apiClient.post(`/intercity-orders/${route.params.orderId}/cancel`);
      await loadOrder();
      navigation.navigate('PassengerHome', {});
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось отменить заявку';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <ServiceScreen
      accentColor="#38BDF8"
      eyebrow="Предложение"
      title="Моя заявка"
      subtitle="Пассажир публикует запрос, а водители видят его и могут взять поездку."
      backLabel="На главную"
      onBack={() => navigation.navigate('PassengerHome', {})}
    >
      <ServiceCard>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{statusLabels[order?.status] || 'Межгород'}</Text>
        </View>
        <InlineLabel label="Маршрут" value={`${order?.fromCity || '-'} -> ${order?.toCity || '-'}`} />
        <InlineLabel label="Выезд" value={order?.departureAt ? new Date(order.departureAt).toLocaleString() : '-'} />
        <InlineLabel label="Мест" value={String(order?.seats || 1)} />
        <InlineLabel label="Багаж" value={order?.baggage || 'Не указан'} />
        <InlineLabel label="Цена" value={`${Math.round(Number(order?.price || 0))} тг`} accentColor="#38BDF8" />
        <InlineLabel label="Комментарий" value={order?.comment || 'Без комментария'} />
        {Array.isArray(order?.stops) && order.stops.length ? (
          <InlineLabel label="Остановки" value={order.stops.join(' • ')} />
        ) : null}
        <InlineLabel label="Салон" value={order?.womenOnly ? 'Только женщины' : 'Любой'} />
        <InlineLabel label="Багаж нужен" value={order?.baggageRequired ? 'Да' : 'Не важно'} />
        <InlineLabel label="Животные" value={order?.noAnimals ? 'Без животных' : 'Можно'} />
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
      <PrimaryButton title="Вернуться в такси" onPress={() => navigation.navigate('PassengerHome', {})} />
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
