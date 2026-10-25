import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { Socket } from 'socket.io-client';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createIntercitySocket } from '../../api/intercitySocket';
import { DarkAlertModal } from '../../components/DarkAlertModal';
import {
  InlineLabel,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';
import { formatIntercityDateTime } from '../../constants/intercity';
import { loadAuth } from '../../storage/authStorage';
import { useThreadUnread } from '../../hooks/useThreadUnread';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityTripStatus'>;

const statusLabels: Record<string, string> = {
  CONFIRMED: 'Забронировано',
  BOARDING: 'Посадка',
  IN_PROGRESS: 'В пути',
  COMPLETED: 'Завершено',
  CANCELED: 'Отменено',
};

/** Until the car leaves, the passenger can still give the seat back. */
const CANCELABLE_STATUSES = ['CONFIRMED', 'BOARDING'];

const cancelReasons: Record<string, string> = {
  PASSENGER: 'Вы отменили бронь. Место снова свободно для других.',
  DRIVER: 'Водитель снял вашу бронь. Поищите другой рейс на это направление.',
  TRIP_CANCELED: 'Водитель отменил рейс. Поищите другой рейс на это направление.',
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
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  const cancelBooking = async () => {
    setConfirmVisible(false);
    setCanceling(true);
    try {
      const response = await apiClient.post(`/intercity-bookings/${route.params.bookingId}/cancel`);
      setOrder(response.data);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось отменить бронь';
      setErrorMessage(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setCanceling(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ServiceScreen
      accentColor={colors.accent}
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
        <InlineLabel label="Выезд" value={formatIntercityDateTime(order?.trip?.departureAt)} accentColor={colors.accent} />
        <InlineLabel label="Мест" value={String(order?.seatsBooked || 1)} />
        <InlineLabel label="Сумма" value={`${Math.round(Number(order?.totalPrice || 0))} тг`} />
      </ServiceCard>

      {order?.status === 'CANCELED' ? (
        <ServiceCard compact>
          <Text style={styles.canceledText}>
            {cancelReasons[order?.canceledBy] || 'Бронь отменена.'}
          </Text>
        </ServiceCard>
      ) : null}

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

      {CANCELABLE_STATUSES.includes(order?.status) ? (
        <SecondaryButton
          title={canceling ? 'Отменяем...' : 'Отменить бронь'}
          onPress={() => {
            if (!canceling) {
              setConfirmVisible(true);
            }
          }}
        />
      ) : null}

      <DarkAlertModal
        visible={confirmVisible}
        title="Отменить бронь?"
        message="Водитель получит уведомление, а ваше место станет свободным для других пассажиров."
        primaryLabel="Отменить бронь"
        secondaryLabel="Не отменять"
        primaryVariant="danger"
        onPrimary={() => {
          cancelBooking().catch(() => null);
        }}
        onSecondary={() => setConfirmVisible(false)}
      />
      <DarkAlertModal
        visible={Boolean(errorMessage)}
        title="Межгород"
        message={errorMessage || ''}
        onPrimary={() => setErrorMessage(null)}
      />
    </ServiceScreen>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  heroBlock: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  heroRoute: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    marginBottom: 8,
  },
  heroText: {
    color: colors.accentText,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSurface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 12,
  },
  pillText: {
    color: colors.accentText,
    fontWeight: '800',
  },
  timeline: {
    gap: 10,
  },
  canceledText: {
    color: colors.dangerText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.borderStrong,
    marginRight: 12,
  },
  timelineDotActive: {
    backgroundColor: colors.accent,
  },
  timelineText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  timelineTextActive: {
    color: colors.text,
  },
});
