import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { Socket } from 'socket.io-client';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createIntercitySocket } from '../../api/intercitySocket';
import { DarkAlertModal } from '../../components/DarkAlertModal';
import { OptionPickerModal } from '../../components/OptionPickerModal';
import { InlineLabel, PrimaryButton, SecondaryButton, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';
import {
  buildIntercityDateOptions,
  composeIntercityDepartureAt,
  formatIntercityDateTime,
  INTERCITY_CITIES,
  INTERCITY_TIME_OPTIONS,
} from '../../constants/intercity';
import { useThreadUnread } from '../../hooks/useThreadUnread';
import { loadAuth } from '../../storage/authStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityTrip'>;

const nextStatusMap: Record<string, { status: string; label: string } | null> = {
  PLANNED: { status: 'BOARDING', label: 'Начать посадку' },
  BOARDING: { status: 'IN_PROGRESS', label: 'Выехать' },
  IN_PROGRESS: { status: 'COMPLETED', label: 'Завершить рейс' },
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
  const dateOptions = useMemo(() => buildIntercityDateOptions(10), []);
  const defaultDate = dateOptions[1]?.value || dateOptions[0]?.value;
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fromCity, setFromCity] = useState('Алматы');
  const [toCity, setToCity] = useState('Астана');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('09:00');
  const [pricePerSeat, setPricePerSeat] = useState('18000');
  const [seatCapacity, setSeatCapacity] = useState('4');
  const [comment, setComment] = useState('');
  const [womenOnly, setWomenOnly] = useState(false);
  const [baggageSpace, setBaggageSpace] = useState(true);
  const [allowAnimals, setAllowAnimals] = useState(true);
  const [picker, setPicker] = useState<'from' | 'to' | 'date' | 'time' | null>(null);
  const [modal, setModal] = useState<{ visible: boolean; title: string; message: string; primaryMode?: 'cancel-trip' }>({
    visible: false,
    title: '',
    message: '',
  });
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

    let mounted = true;
    let socket: Socket | null = null;

    const setupSocket = async () => {
      const auth = await loadAuth();
      if (!auth?.accessToken || !mounted) {
        return;
      }
      socket = createIntercitySocket(auth.accessToken);
      socket.on('connect', () => {
        socket?.emit('join:intercity-trip', { tripId: route.params?.tripId });
      });
      socket.on('intercity-trip:updated', (nextTrip: any) => {
        if (!mounted || nextTrip?.id !== route.params?.tripId) {
          return;
        }
        setTrip(nextTrip);
        setLoading(false);
      });
      socket.on('intercity-booking:updated', () => {
        if (!mounted) {
          return;
        }
        loadTrip().catch(() => null);
      });
    };

    setupSocket().catch(() => null);
    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, [loadTrip, route.params?.tripId]);

  const showError = (error: any, fallback: string) => {
    const message = error?.response?.data?.message || fallback;
    setModal({
      visible: true,
      title: 'Межгород',
      message: Array.isArray(message) ? message.join(', ') : message,
    });
  };

  const createTrip = async () => {
    setSaving(true);
    try {
      const departureAt = composeIntercityDepartureAt(date, time);
      const response = await apiClient.post('/intercity-trips', {
        fromCity,
        toCity,
        departureAt,
        pricePerSeat: Number(pricePerSeat),
        seatCapacity: Number(seatCapacity),
        comment: comment.trim() || undefined,
        womenOnly,
        baggageSpace,
        allowAnimals,
      });
      navigation.navigate('IntercityTrip', { tripId: response.data.id });
    } catch (error: any) {
      showError(error, 'Не удалось создать рейс');
    } finally {
      setSaving(false);
    }
  };

  const advanceStatus = async () => {
    const next = nextStatusMap[trip?.status];
    if (!next) {
      return;
    }
    try {
      await apiClient.patch(`/intercity-trips/${trip.id}/status`, { status: next.status });
      await loadTrip();
    } catch (error: any) {
      showError(error, 'Не удалось обновить статус рейса');
    }
  };

  const confirmCancel = () => {
    setModal({
      visible: true,
      title: 'Отменить рейс?',
      message: 'Рейс будет снят, а пассажиры увидят отмену.',
      primaryMode: 'cancel-trip',
    });
  };

  const cancelTrip = async () => {
    try {
      await apiClient.patch(`/intercity-trips/${trip.id}/status`, { status: 'CANCELED' });
      setModal({ visible: false, title: '', message: '' });
      navigation.goBack();
    } catch (error: any) {
      showError(error, 'Не удалось отменить рейс');
    }
  };

  const bookedSeats = useMemo(
    () =>
      Array.isArray(trip?.bookings)
        ? trip.bookings.reduce((sum: number, booking: any) => sum + Number(booking.seatsBooked || 0), 0)
        : 0,
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
      <ServiceScreen accentColor="#38BDF8" title="Создать свой рейс" subtitle="" backLabel="Назад" onBack={() => navigation.goBack()}>
        <ServiceCard>
          <TouchableOpacity style={styles.selectField} activeOpacity={0.9} onPress={() => setPicker('from')}>
            <Text style={styles.fieldLabel}>Откуда</Text>
            <Text style={styles.fieldValue}>{fromCity}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.selectField} activeOpacity={0.9} onPress={() => setPicker('to')}>
            <Text style={styles.fieldLabel}>Куда</Text>
            <Text style={styles.fieldValue}>{toCity}</Text>
          </TouchableOpacity>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.selectField, styles.half]} activeOpacity={0.9} onPress={() => setPicker('date')}>
              <Text style={styles.fieldLabel}>Дата</Text>
              <Text style={styles.fieldValueSmall}>
                {dateOptions.find((option) => option.value === date)?.label || date}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.selectField, styles.half]} activeOpacity={0.9} onPress={() => setPicker('time')}>
              <Text style={styles.fieldLabel}>Время</Text>
              <Text style={styles.fieldValue}>{time}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            value={pricePerSeat}
            onChangeText={setPricePerSeat}
            keyboardType="number-pad"
            placeholder="Цена за место"
            placeholderTextColor="#71717A"
          />
          <TextInput
            style={styles.input}
            value={seatCapacity}
            onChangeText={setSeatCapacity}
            keyboardType="number-pad"
            placeholder="Сколько мест"
            placeholderTextColor="#71717A"
          />
          <TextInput style={[styles.input, styles.commentInput]} value={comment} onChangeText={setComment} placeholder="Комментарий" placeholderTextColor="#71717A" multiline />
          <View style={styles.preferenceRow}>
            <SecondaryButton title={womenOnly ? 'Женский салон: Да' : 'Женский салон: Нет'} onPress={() => setWomenOnly((value) => !value)} />
            <SecondaryButton title={baggageSpace ? 'Есть багаж' : 'Без багажа'} onPress={() => setBaggageSpace((value) => !value)} />
            <SecondaryButton title={allowAnimals ? 'Животные можно' : 'Без животных'} onPress={() => setAllowAnimals((value) => !value)} />
          </View>
        </ServiceCard>
        <PrimaryButton title={saving ? 'Создаем...' : 'Создать рейс'} onPress={createTrip} accentColor="#38BDF8" />

        <OptionPickerModal
          visible={picker === 'from'}
          title="Город отправления"
          options={INTERCITY_CITIES.map((city) => ({ value: city, label: city }))}
          selectedValue={fromCity}
          onSelect={setFromCity}
          onClose={() => setPicker(null)}
        />
        <OptionPickerModal
          visible={picker === 'to'}
          title="Город прибытия"
          options={INTERCITY_CITIES.map((city) => ({ value: city, label: city }))}
          selectedValue={toCity}
          onSelect={setToCity}
          onClose={() => setPicker(null)}
        />
        <OptionPickerModal
          visible={picker === 'date'}
          title="Дата рейса"
          options={dateOptions}
          selectedValue={date}
          onSelect={setDate}
          onClose={() => setPicker(null)}
        />
        <OptionPickerModal
          visible={picker === 'time'}
          title="Время рейса"
          options={INTERCITY_TIME_OPTIONS.map((option) => ({ value: option, label: option }))}
          selectedValue={time}
          onSelect={setTime}
          onClose={() => setPicker(null)}
        />
        <DarkAlertModal
          visible={modal.visible}
          title={modal.title}
          message={modal.message}
          primaryLabel="Понятно"
          onPrimary={() => setModal({ visible: false, title: '', message: '' })}
        />
      </ServiceScreen>
    );
  }

  return (
    <ServiceScreen accentColor="#38BDF8" title="Мой рейс" subtitle="" backLabel="Назад" onBack={() => navigation.goBack()}>
      <View style={styles.heroBlock}>
        <Text style={styles.heroRoute}>{`${trip?.fromCity || '-'} → ${trip?.toCity || '-'}`}</Text>
        <Text style={styles.heroText}>{statusLabels[trip?.status] || 'Рейс обновляется'}</Text>
      </View>

      <ServiceCard>
        <InlineLabel label="Статус" value={statusLabels[trip?.status] || 'Рейс'} accentColor="#38BDF8" />
        <InlineLabel label="Выезд" value={formatIntercityDateTime(trip?.departureAt)} />
        <InlineLabel label="Цена за место" value={`${Math.round(Number(trip?.pricePerSeat || 0))} тг`} />
        <InlineLabel label="Занято мест" value={`${bookedSeats} из ${trip?.seatCapacity || 0}`} />
        <InlineLabel label="Салон" value={trip?.womenOnly ? 'Женский' : 'Любой'} />
        <InlineLabel label="Багаж" value={trip?.baggageSpace ? 'Есть место' : 'Без багажа'} />
        <InlineLabel label="Животные" value={trip?.allowAnimals ? 'Можно' : 'Нельзя'} />
        {trip?.comment ? <InlineLabel label="Комментарий" value={trip.comment} /> : null}
      </ServiceCard>

      <ServiceCard compact>
        <View style={styles.passengersHeader}>
          <Text style={styles.sectionTitle}>Пассажиры</Text>
          <TouchableOpacity
            style={styles.tripChatButton}
            activeOpacity={0.88}
            onPress={() =>
              navigation.navigate('IntercityChat', {
                threadType: 'TRIP',
                threadId: trip.id,
                title: `Рейс ${trip.fromCity} → ${trip.toCity}`,
              })
            }
          >
            <Text style={styles.tripChatButtonText}>
              {(intercityUnreadByThread[`TRIP:${trip?.id}`] ?? 0) > 0
                ? `Чат рейса (${Math.min(intercityUnreadByThread[`TRIP:${trip?.id}`], 99)})`
                : 'Чат рейса'}
            </Text>
          </TouchableOpacity>
        </View>
        {trip?.bookings?.length ? (
          trip.bookings.map((booking: any) => (
            <View key={booking.id} style={styles.bookingCard}>
              <Text style={styles.bookingName}>{booking.passenger?.fullName || booking.passenger?.user?.phone || 'Пассажир'}</Text>
              <Text style={styles.bookingMeta}>
                {booking.seatsBooked} мест • {Math.round(Number(booking.totalPrice || 0))} тг
              </Text>
              <Text style={styles.bookingMeta}>Телефон: {booking.passenger?.user?.phone || '-'}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Пока никто не забронировал этот рейс.</Text>
        )}
      </ServiceCard>

      {nextStatusMap[trip?.status] ? (
        <PrimaryButton title={nextStatusMap[trip?.status]?.label || 'Следующий этап'} onPress={advanceStatus} accentColor="#38BDF8" />
      ) : null}
      {trip?.status && trip.status !== 'COMPLETED' && trip.status !== 'CANCELED' ? (
        <SecondaryButton title="Отменить рейс" onPress={confirmCancel} />
      ) : null}

      <DarkAlertModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        primaryLabel={modal.primaryMode === 'cancel-trip' ? 'Отменить рейс' : 'Понятно'}
        secondaryLabel={modal.primaryMode === 'cancel-trip' ? 'Не сейчас' : undefined}
        onPrimary={() => {
          if (modal.primaryMode === 'cancel-trip') {
            cancelTrip().catch(() => null);
            return;
          }
          setModal({ visible: false, title: '', message: '' });
        }}
        onSecondary={
          modal.primaryMode === 'cancel-trip'
            ? () => setModal({ visible: false, title: '', message: '' })
            : undefined
        }
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
  selectField: {
    backgroundColor: '#09090B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  fieldLabel: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  fieldValue: {
    color: '#F4F4F5',
    fontSize: 16,
    fontWeight: '800',
  },
  fieldValueSmall: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  half: {
    flex: 1,
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
  passengersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  tripChatButton: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1D4ED8',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tripChatButtonText: {
    color: '#DBEAFE',
    fontSize: 13,
    fontWeight: '800',
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
