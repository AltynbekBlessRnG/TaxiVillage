import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { Socket } from 'socket.io-client';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createIntercitySocket } from '../../api/intercitySocket';
import {
  InlineLabel,
  PrimaryButton,
  SectionTitle,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';
import { formatIntercityDateTime } from '../../constants/intercity';
import { loadAuth } from '../../storage/authStorage';
import { useThreadUnread } from '../../hooks/useThreadUnread';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityTripStatus'>;

const statusLabels: Record<string, string> = {
  CONFIRMED: 'Забронировано',
  BOARDING: 'Посадка',
  IN_PROGRESS: 'В пути',
  COMPLETED: 'Завершено',
  CANCELED: 'Отменено',
};

const tripStages = [
  { key: 'CONFIRMED', title: 'Бронь подтверждена' },
  { key: 'BOARDING', title: 'Посадка' },
  { key: 'IN_PROGRESS', title: 'В пути' },
  { key: 'COMPLETED', title: 'Поездка завершена' },
];

export const IntercityTripStatusScreen: React.FC<Props> = ({ navigation, route }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { intercityUnreadByThread, refresh: refreshThreadUnread } = useThreadUnread({ autoRefresh: false });

  const loadOrder = useCallback(() => {
    apiClient
      .get(`/intercity-bookings/${route.params.bookingId}`)
      .then((response) => setOrder(response.data))
      .finally(() => setLoading(false));
  }, [route.params.bookingId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useFocusEffect(
    useCallback(() => {
      refreshThreadUnread().catch(() => null);
      loadOrder();
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
        socket?.emit('join:intercity-booking', { bookingId: route.params.bookingId });
      });
      socket.on('intercity-booking:updated', (nextOrder: any) => {
        if (!isMounted || nextOrder?.id !== route.params.bookingId) {
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
  }, [route.params.bookingId]);

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
      title="Статус бронирования"
      subtitle=""
      backLabel="На главную"
      onBack={() => navigation.navigate('PassengerHome', {})}
    >
      <View style={styles.heroBlock}>
        <Text style={styles.heroRoute}>{`${order?.trip?.fromCity || '-'} → ${order?.trip?.toCity || '-'}`}</Text>
        <Text style={styles.heroText}>{statusLabels[order?.status] || 'Статус обновляется'}</Text>
      </View>

      <ServiceCard>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{statusLabels[order?.status] || 'Межгород'}</Text>
        </View>
        <InlineLabel label="Маршрут" value={`${order?.trip?.fromCity || '-'} → ${order?.trip?.toCity || '-'}`} />
        <InlineLabel label="Водитель" value={order?.trip?.driver?.fullName || order?.trip?.driver?.user?.phone || 'Водитель'} />
        <InlineLabel label="Телефон" value={order?.trip?.driver?.user?.phone || '-'} />
        <InlineLabel label="Выезд" value={formatIntercityDateTime(order?.trip?.departureAt)} accentColor="#38BDF8" />
        <InlineLabel label="Мест" value={String(order?.seatsBooked || 1)} />
        <InlineLabel label="Сумма" value={`${Math.round(Number(order?.totalPrice || 0))} тг`} />
      </ServiceCard>

      <ServiceCard compact>
        <SectionTitle>Статусы поездки</SectionTitle>
        <View style={styles.timeline}>
          {tripStages.map((stage, index) => {
            const currentIndex = tripStages.findIndex((item) => item.key === order?.status);
            const isCompleted = currentIndex >= index || order?.status === 'COMPLETED';
            return (
              <View key={stage.key} style={styles.timelineRow}>
                <View style={[styles.timelineDot, isCompleted && styles.timelineDotActive]} />
                <Text style={[styles.timelineText, isCompleted && styles.timelineTextActive]}>{stage.title}</Text>
              </View>
            );
          })}
        </View>
      </ServiceCard>

      {order?.trip?.driver ? (
        <PrimaryButton
          title={
            (intercityUnreadByThread[`TRIP:${order?.trip?.id}`] ?? 0) > 0
              ? `Чат рейса (${Math.min(intercityUnreadByThread[`TRIP:${order?.trip?.id}`], 99)})`
              : 'Чат рейса'
          }
          onPress={() =>
            navigation.navigate('IntercityChat', {
              threadType: 'TRIP',
              threadId: order.trip.id,
              title: `Рейс ${order.trip.fromCity} → ${order.trip.toCity}`,
            })
          }
        />
      ) : null}

      <PrimaryButton title="К такси" onPress={() => navigation.navigate('PassengerHome', {})} />
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
  heroBlock: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  heroRoute: {
    color: '#F4F4F5',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    marginBottom: 8,
  },
  heroText: {
    color: '#7DD3FC',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
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
  timeline: {
    gap: 10,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#334155',
    marginRight: 12,
  },
  timelineDotActive: {
    backgroundColor: '#38BDF8',
  },
  timelineText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  timelineTextActive: {
    color: '#F4F4F5',
  },
});
