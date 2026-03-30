import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { Socket } from 'socket.io-client';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createIntercitySocket } from '../../api/intercitySocket';
import { loadAuth } from '../../storage/authStorage';
import { InlineLabel, PrimaryButton, SecondaryButton, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';
import { useThreadUnread } from '../../hooks/useThreadUnread';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityRequests'>;

const nextStatusMap: Record<string, string | null> = {
  CONFIRMED: 'DRIVER_EN_ROUTE',
  DRIVER_EN_ROUTE: 'BOARDING',
  BOARDING: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
  COMPLETED: null,
  CANCELED: null,
  SEARCHING_DRIVER: null,
};

const statusLabels: Record<string, string> = {
  SEARCHING_DRIVER: 'Ищет водителя',
  CONFIRMED: 'Подтверждено',
  DRIVER_EN_ROUTE: 'Водитель выехал',
  BOARDING: 'Посадка',
  IN_PROGRESS: 'В пути',
  COMPLETED: 'Завершено',
  CANCELED: 'Отменено',
};

export const IntercityRequestsScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const { intercityUnreadByThread, refresh: refreshThreadUnread } = useThreadUnread();

  const loadData = useCallback(async () => {
    try {
      const [availableRes, myRes] = await Promise.all([
        apiClient.get('/intercity-orders/available').catch(() => ({ data: [] })),
        apiClient.get('/intercity-orders/driver/my').catch(() => ({ data: [] })),
      ]);
      setAvailableOrders(Array.isArray(availableRes.data) ? availableRes.data : []);
      setMyOrders(Array.isArray(myRes.data) ? myRes.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      refreshThreadUnread().catch(() => null);
      loadData().catch(() => null);
      return undefined;
    }, [loadData, refreshThreadUnread]),
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
      socket.on('intercity-order:updated', () => {
        if (!isMounted) {
          return;
        }
        loadData().catch(() => null);
      });
      socket.on('intercity-trip:updated', () => {
        if (!isMounted) {
          return;
        }
        loadData().catch(() => null);
      });
    };

    setupSocket().catch(() => null);

    return () => {
      isMounted = false;
      socket?.disconnect();
    };
  }, [loadData]);

  const acceptOrder = useCallback(
    async (orderId: string) => {
      try {
        await apiClient.post(`/intercity-orders/${orderId}/accept`);
        await loadData();
      } catch (error: any) {
        const message = error?.response?.data?.message || 'Не удалось взять заявку';
        Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
      }
    },
    [loadData],
  );

  const advanceStatus = useCallback(
    async (order: any) => {
      const nextStatus = nextStatusMap[order?.status];
      if (!nextStatus) {
        return;
      }

      try {
        await apiClient.post(`/intercity-orders/${order.id}/status`, { status: nextStatus });
        await loadData();
      } catch (error: any) {
        const message = error?.response?.data?.message || 'Не удалось обновить статус';
        Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
      }
    },
    [loadData],
  );

  const cancelOrder = useCallback(
    async (orderId: string) => {
      try {
        await apiClient.post(`/intercity-orders/${orderId}/driver-cancel`);
        await loadData();
      } catch (error: any) {
        const message = error?.response?.data?.message || 'Не удалось отменить заявку';
        Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
      }
    },
    [loadData],
  );

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
      eyebrow="Заявки"
      title="Клиентские предложения"
      subtitle="Водитель видит, кто хочет поехать между городами, и может взять подходящую заявку."
      backLabel="К межгороду"
      onBack={() => navigation.goBack()}
    >
      <ServiceCard>
        <InlineLabel label="Активных моих" value={String(myOrders.filter((order) => !['COMPLETED', 'CANCELED'].includes(order.status)).length)} />
        <InlineLabel label="Свободных заявок" value={String(availableOrders.length)} accentColor="#38BDF8" />
      </ServiceCard>

      <ScrollView contentContainerStyle={styles.content}>
        <ServiceCard compact>
          <Text style={styles.sectionTitle}>Мои межгородние заявки</Text>
          {myOrders.length === 0 ? (
            <Text style={styles.emptyText}>Вы еще не взяли ни одной клиентской заявки.</Text>
          ) : (
            myOrders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <Text style={styles.routeText}>{`${order.fromCity} -> ${order.toCity}`}</Text>
                <Text style={styles.metaText}>
                  {new Date(order.departureAt).toLocaleString()} • {Math.round(Number(order.price || 0))} тг
                </Text>
                <Text style={styles.metaText}>
                  {statusLabels[order.status] || order.status} • {order.passenger?.fullName || order.passenger?.user?.phone || 'Пассажир'}
                </Text>
                <Text style={styles.metaText}>Мест: {order.seats} • Багаж: {order.baggage || 'Не указан'}</Text>
                <Text style={styles.metaText}>
                  {order.womenOnly ? 'Только женский салон' : 'Любой салон'} • {order.baggageRequired ? 'Нужен багаж' : 'Багаж не важен'} •{' '}
                  {order.noAnimals ? 'Без животных' : 'Животные допустимы'}
                </Text>
                {Array.isArray(order.stops) && order.stops.length ? (
                  <Text style={styles.metaText}>Остановки: {order.stops.join(' • ')}</Text>
                ) : null}
                {order.comment ? <Text style={styles.commentText}>{order.comment}</Text> : null}
                <SecondaryButton
                  title={
                    (intercityUnreadByThread[`ORDER:${order.id}`] ?? 0) > 0
                      ? `Открыть чат (${Math.min(intercityUnreadByThread[`ORDER:${order.id}`], 99)})`
                      : 'Открыть чат'
                  }
                  onPress={() =>
                    navigation.navigate('IntercityChat', {
                      threadType: 'ORDER',
                      threadId: order.id,
                      title: order.passenger?.fullName || order.passenger?.user?.phone || 'Чат с пассажиром',
                    })
                  }
                />
                {nextStatusMap[order.status] ? (
                  <PrimaryButton title="Следующий этап" onPress={() => advanceStatus(order)} accentColor="#38BDF8" />
                ) : null}
                {['CONFIRMED', 'DRIVER_EN_ROUTE', 'BOARDING'].includes(order.status) ? (
                  <SecondaryButton title="Отменить заявку" onPress={() => cancelOrder(order.id)} />
                ) : null}
              </View>
            ))
          )}
        </ServiceCard>

        <ServiceCard compact>
          <Text style={styles.sectionTitle}>Свежие заявки пассажиров</Text>
          {availableOrders.length === 0 ? (
            <Text style={styles.emptyText}>Сейчас нет новых заявок по межгороду.</Text>
          ) : (
            availableOrders.map((order) => (
              <TouchableOpacity key={order.id} style={styles.orderCard} activeOpacity={0.9}>
                <Text style={styles.routeText}>{`${order.fromCity} -> ${order.toCity}`}</Text>
                <Text style={styles.metaText}>
                  {new Date(order.departureAt).toLocaleString()} • {Math.round(Number(order.price || 0))} тг
                </Text>
                <Text style={styles.metaText}>
                  {order.passenger?.fullName || order.passenger?.user?.phone || 'Пассажир'} • Мест: {order.seats}
                </Text>
                <Text style={styles.metaText}>Багаж: {order.baggage || 'Не указан'}</Text>
                <Text style={styles.metaText}>
                  {order.womenOnly ? 'Только женский салон' : 'Любой салон'} • {order.baggageRequired ? 'Нужен багаж' : 'Багаж не важен'} •{' '}
                  {order.noAnimals ? 'Без животных' : 'Животные допустимы'}
                </Text>
                {Array.isArray(order.stops) && order.stops.length ? (
                  <Text style={styles.metaText}>Остановки: {order.stops.join(' • ')}</Text>
                ) : null}
                {order.comment ? <Text style={styles.commentText}>{order.comment}</Text> : null}
                <SecondaryButton title="Взять заявку" onPress={() => acceptOrder(order.id)} />
              </TouchableOpacity>
            ))
          )}
        </ServiceCard>
      </ScrollView>
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
  content: {
    gap: 14,
  },
  sectionTitle: {
    color: '#F4F4F5',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },
  emptyText: {
    color: '#A1A1AA',
    fontSize: 14,
  },
  orderCard: {
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  routeText: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
  },
  metaText: {
    color: '#A1A1AA',
    fontSize: 13,
  },
  commentText: {
    color: '#D4D4D8',
    fontSize: 13,
    lineHeight: 18,
  },
});
