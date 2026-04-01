import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { Socket } from 'socket.io-client';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createIntercitySocket } from '../../api/intercitySocket';
import { loadAuth } from '../../storage/authStorage';
import { InlineLabel, PrimaryButton, SecondaryButton, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';
import { useThreadUnread } from '../../hooks/useThreadUnread';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityTrip'>;

const nextStatusMap: Record<string, string | null> = {
  PLANNED: 'BOARDING',
  BOARDING: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
  COMPLETED: null,
  CANCELED: null,
};

const statusLabels: Record<string, string> = {
  PLANNED: 'Запланирован',
  BOARDING: 'Посадка',
  IN_PROGRESS: 'В пути',
  COMPLETED: 'Завершен',
  CANCELED: 'Отменен',
};

export const IntercityTripScreen: React.FC<Props> = ({ navigation, route }) => {
  const defaultDepartureAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fromCity, setFromCity] = useState('Алматы');
  const [toCity, setToCity] = useState('Алаколь');
  const [departureAt, setDepartureAt] = useState(defaultDepartureAt);
  const [pricePerSeat, setPricePerSeat] = useState('18000');
  const [seatCapacity, setSeatCapacity] = useState('4');
  const [comment, setComment] = useState('');
  const [stops, setStops] = useState('');
  const [womenOnly, setWomenOnly] = useState(false);
  const [baggageSpace, setBaggageSpace] = useState(true);
  const [allowAnimals, setAllowAnimals] = useState(true);
  const { intercityUnreadByThread, refresh: refreshThreadUnread } = useThreadUnread({ autoRefresh: false });

  const isCreateMode = !route.params?.tripId;

  const loadTrip = useCallback(async () => {
    if (!route.params?.tripId) {
      setTrip(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.get(`/intercity-trips/${route.params.tripId}`);
      setTrip(response.data);
    } finally {
      setLoading(false);
    }
  }, [route.params?.tripId]);

  useEffect(() => {
    loadTrip().catch(() => null);
  }, [loadTrip]);

  useFocusEffect(
    useCallback(() => {
      if (!route.params?.tripId) {
        return () => undefined;
      }
      refreshThreadUnread().catch(() => null);
      loadTrip().catch(() => null);
      return () => undefined;
    }, [loadTrip, refreshThreadUnread, route.params?.tripId]),
  );

  useEffect(() => {
    if (!route.params?.tripId) {
      return undefined;
    }

    let isMounted = true;
    let socket: Socket | null = null;

    const setupSocket = async () => {
      const auth = await loadAuth();
      if (!auth?.accessToken || !isMounted) {
        return;
      }

      socket = createIntercitySocket(auth.accessToken);
      socket.on('connect', () => {
        socket?.emit('join:intercity-trip', { tripId: route.params?.tripId });
      });
      socket.on('intercity-trip:updated', (nextTrip: any) => {
        if (!isMounted || nextTrip?.id !== route.params?.tripId) {
          return;
        }
        setTrip(nextTrip);
        setLoading(false);
      });
      socket.on('intercity-booking:updated', () => {
        if (!isMounted) {
          return;
        }
        loadTrip().catch(() => null);
      });
    };

    setupSocket().catch(() => null);

    return () => {
      isMounted = false;
      socket?.disconnect();
    };
  }, [loadTrip, route.params?.tripId]);

  const createTrip = async () => {
    setSaving(true);
    try {
      const isoDate = departureAt.includes('T') ? `${departureAt}:00.000Z` : new Date(departureAt).toISOString();
      const response = await apiClient.post('/intercity-trips', {
        fromCity,
        toCity,
        departureAt: isoDate,
        pricePerSeat: Number(pricePerSeat),
        seatCapacity: Number(seatCapacity),
        comment: comment.trim() || undefined,
        stops: stops
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        womenOnly,
        baggageSpace,
        allowAnimals,
      });
      navigation.navigate('IntercityTrip', { tripId: response.data.id });
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось создать рейс';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setSaving(false);
    }
  };

  const advanceStatus = async () => {
    const nextStatus = nextStatusMap[trip?.status];
    if (!nextStatus) {
      return;
    }
    try {
      await apiClient.patch(`/intercity-trips/${trip.id}/status`, { status: nextStatus });
      await loadTrip();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось обновить статус рейса';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    }
  };

  const cancelTrip = async () => {
    if (!trip?.id) {
      return;
    }

    Alert.alert('Отменить рейс?', 'Рейс будет снят, а активные бронирования получат статус отмены.', [
      { text: 'Нет', style: 'cancel' },
      {
        text: 'Отменить рейс',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.patch(`/intercity-trips/${trip.id}/status`, { status: 'CANCELED' });
            navigation.goBack();
          } catch (error: any) {
            const message = error?.response?.data?.message || 'Не удалось отменить рейс';
            Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
          }
        },
      },
    ]);
  };

  const bookedSeats = useMemo(
    () => (Array.isArray(trip?.bookings) ? trip.bookings.reduce((sum: number, booking: any) => sum + Number(booking.seatsBooked || 0), 0) : 0),
    [trip?.bookings],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  if (isCreateMode) {
    return (
      <ServiceScreen
        accentColor="#38BDF8"
        eyebrow="Создать рейс"
        title="Новый межгород"
        subtitle="Водитель публикует поездку, а пассажиры бронируют места."
        backLabel="К водителю"
        onBack={() => navigation.goBack()}
      >
        <ServiceCard>
          <TextInput style={styles.input} value={fromCity} onChangeText={setFromCity} placeholder="Откуда" placeholderTextColor="#71717A" />
          <TextInput style={styles.input} value={toCity} onChangeText={setToCity} placeholder="Куда" placeholderTextColor="#71717A" />
          <TextInput style={styles.input} value={departureAt} onChangeText={setDepartureAt} placeholder="2026-03-23T09:00" placeholderTextColor="#71717A" />
          <TextInput style={styles.input} value={pricePerSeat} onChangeText={setPricePerSeat} keyboardType="number-pad" placeholder="Цена за место" placeholderTextColor="#71717A" />
          <TextInput style={styles.input} value={seatCapacity} onChangeText={setSeatCapacity} keyboardType="number-pad" placeholder="Сколько мест" placeholderTextColor="#71717A" />
          <TextInput style={[styles.input, styles.commentInput]} value={comment} onChangeText={setComment} placeholder="Комментарий" placeholderTextColor="#71717A" multiline />
          <TextInput style={styles.input} value={stops} onChangeText={setStops} placeholder="Остановки по пути через запятую" placeholderTextColor="#71717A" />
          <View style={styles.preferenceRow}>
            <SecondaryButton title={womenOnly ? 'Женский салон: Да' : 'Женский салон: Нет'} onPress={() => setWomenOnly((value) => !value)} />
            <SecondaryButton title={baggageSpace ? 'Есть багаж' : 'Без багажа'} onPress={() => setBaggageSpace((value) => !value)} />
            <SecondaryButton title={allowAnimals ? 'Животные можно' : 'Без животных'} onPress={() => setAllowAnimals((value) => !value)} />
          </View>
        </ServiceCard>
        <PrimaryButton title={saving ? 'Создаем...' : 'Создать поездку'} onPress={createTrip} accentColor="#38BDF8" />
      </ServiceScreen>
    );
  }

  return (
    <ServiceScreen
      accentColor="#38BDF8"
      eyebrow="Активный рейс"
      title="Межгородний рейс"
      subtitle="Следи за заполнением мест, пассажирами и статусом поездки в одном рабочем экране."
      backLabel="К водителю"
      onBack={() => navigation.goBack()}
    >
      <View style={styles.heroBlock}>
        <Text style={styles.heroRoute}>{`${trip?.fromCity || '-'} → ${trip?.toCity || '-'}`}</Text>
        <Text style={styles.heroText}>{statusLabels[trip?.status] || 'Рейс обновляется'}</Text>
      </View>

      <ServiceCard>
        <InlineLabel label="Статус" value={statusLabels[trip?.status] || 'Рейс'} accentColor="#38BDF8" />
        <InlineLabel label="Маршрут" value={`${trip?.fromCity || '-'} -> ${trip?.toCity || '-'}`} />
        <InlineLabel label="Выезд" value={trip?.departureAt ? new Date(trip.departureAt).toLocaleString() : '-'} />
        <InlineLabel label="Занято мест" value={`${bookedSeats} из ${trip?.seatCapacity || 0}`} />
        {Array.isArray(trip?.stops) && trip.stops.length ? (
          <InlineLabel label="Остановки" value={trip.stops.join(' • ')} />
        ) : null}
        <InlineLabel label="Салон" value={trip?.womenOnly ? 'Только женщины' : 'Любой'} />
        <InlineLabel label="Багаж" value={trip?.baggageSpace ? 'Есть место для багажа' : 'Без багажа'} />
        <InlineLabel label="Животные" value={trip?.allowAnimals ? 'Разрешены' : 'Без животных'} />
      </ServiceCard>

      <ServiceCard compact>
        <Text style={styles.sectionTitle}>Пассажиры</Text>
        {trip?.bookings?.length ? (
          trip.bookings.map((booking: any) => (
            <View key={booking.id} style={styles.bookingCard}>
              <Text style={styles.bookingName}>{booking.passenger?.fullName || booking.passenger?.user?.phone || 'Пассажир'}</Text>
              <Text style={styles.bookingMeta}>
                {booking.seatsBooked} мест • {Math.round(Number(booking.totalPrice || 0))} тг
              </Text>
              <Text style={styles.bookingMeta}>Телефон: {booking.passenger?.user?.phone || '-'}</Text>
              <SecondaryButton
                title={
                  (intercityUnreadByThread[`BOOKING:${booking.id}`] ?? 0) > 0
                    ? `Чат с пассажиром (${Math.min(intercityUnreadByThread[`BOOKING:${booking.id}`], 99)})`
                    : 'Чат с пассажиром'
                }
                onPress={() =>
                  navigation.navigate('IntercityChat', {
                    threadType: 'BOOKING',
                    threadId: booking.id,
                    title: booking.passenger?.fullName || booking.passenger?.user?.phone || 'Чат с пассажиром',
                  })
                }
              />
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Пока никто не забронировал этот рейс.</Text>
        )}
      </ServiceCard>

      {nextStatusMap[trip?.status] ? (
        <PrimaryButton title="Следующий этап" onPress={advanceStatus} accentColor="#38BDF8" />
      ) : null}
      {trip?.status && trip.status !== 'COMPLETED' && trip.status !== 'CANCELED' ? (
        <SecondaryButton title="Отменить рейс" onPress={cancelTrip} />
      ) : null}
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
  input: {
    backgroundColor: '#09090B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#F4F4F5',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 10,
  },
  commentInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  preferenceRow: {
    gap: 10,
  },
  sectionTitle: {
    color: '#F4F4F5',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },
  bookingCard: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  bookingName: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  bookingMeta: {
    color: '#A1A1AA',
    fontSize: 13,
    marginBottom: 2,
  },
  emptyText: {
    color: '#A1A1AA',
    fontSize: 14,
  },
});
