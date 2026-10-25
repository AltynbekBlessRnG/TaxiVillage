import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityTrip'>;

const nextStatusMap: Record<string, { status: string; label: string } | null> = {
  PLANNED: { status: 'BOARDING', label: 'Начать посадку' },
  BOARDING: { status: 'IN_PROGRESS', label: 'Выехать' },
  IN_PROGRESS: { status: 'COMPLETED', label: 'Завершить рейс' },
  COMPLETED: null,
  CANCELED: null,
};

/** Until the car leaves, seats can change and passengers can be taken out. */
const EDITABLE_TRIP_STATUSES = ['PLANNED', 'BOARDING'];
const REMOVABLE_BOOKING_STATUSES = ['CONFIRMED', 'BOARDING'];

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
  const [modal, setModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    primaryMode?: 'cancel-trip' | 'remove-booking';
    bookingId?: string;
  }>({
    visible: false,
    title: '',
    message: '',
  });
  const [savingSeats, setSavingSeats] = useState(false);
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

  const confirmRemoveBooking = (booking: any) => {
    const name = booking.passenger?.fullName || booking.passenger?.user?.phone || 'Пассажир';
    setModal({
      visible: true,
      title: 'Убрать пассажира?',
      message: `${name} получит уведомление, что бронь снята, а места снова станут свободными.`,
      primaryMode: 'remove-booking',
      bookingId: booking.id,
    });
  };

  const removeBooking = async (bookingId: string) => {
    try {
      const response = await apiClient.post(`/intercity-trips/${trip.id}/bookings/${bookingId}/remove`);
      setTrip(response.data);
      setModal({ visible: false, title: '', message: '' });
    } catch (error: any) {
      showError(error, 'Не удалось убрать пассажира');
    }
  };

  const activeBookings = useMemo(
    () =>
      Array.isArray(trip?.bookings)
        ? trip.bookings.filter((booking: any) => booking.status !== 'CANCELED')
        : [],
    [trip?.bookings],
  );
  const bookedSeats = activeBookings.reduce(
    (sum: number, booking: any) => sum + Number(booking.seatsBooked || 0),
    0,
  );
  const seatCapacityTotal = Number(trip?.seatCapacity || 0);
  const offlineSeats = Number(trip?.offlineSeats || 0);
  const maxOfflineSeats = Math.max(seatCapacityTotal - bookedSeats, 0);
  const freeSeatsLeft = Math.max(seatCapacityTotal - bookedSeats - offlineSeats, 0);
  const canEditTrip = EDITABLE_TRIP_STATUSES.includes(trip?.status);

  const saveOfflineSeats = async (next: number) => {
    if (savingSeats || next < 0 || next > maxOfflineSeats || next === offlineSeats) {
      return;
    }
    setSavingSeats(true);
    try {
      const response = await apiClient.patch(`/intercity-trips/${trip.id}/offline-seats`, {
        offlineSeats: next,
      });
      setTrip(response.data);
    } catch (error: any) {
      showError(error, 'Не удалось обновить места');
    } finally {
      setSavingSeats(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (isCreateMode) {
    return (
      <ServiceScreen accentColor={colors.accent} title="Создать свой рейс" subtitle="" backLabel="Назад" onBack={() => navigation.goBack()}>
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
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={styles.input}
            value={seatCapacity}
            onChangeText={setSeatCapacity}
            keyboardType="number-pad"
            placeholder="Сколько мест"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput style={[styles.input, styles.commentInput]} value={comment} onChangeText={setComment} placeholder="Комментарий" placeholderTextColor={colors.textTertiary} multiline />
          <View style={styles.preferenceRow}>
            <SecondaryButton title={womenOnly ? 'Женский салон: Да' : 'Женский салон: Нет'} onPress={() => setWomenOnly((value) => !value)} />
            <SecondaryButton title={baggageSpace ? 'Есть багаж' : 'Без багажа'} onPress={() => setBaggageSpace((value) => !value)} />
            <SecondaryButton title={allowAnimals ? 'Животные можно' : 'Без животных'} onPress={() => setAllowAnimals((value) => !value)} />
          </View>
        </ServiceCard>
        <PrimaryButton title={saving ? 'Создаем...' : 'Создать рейс'} onPress={createTrip} accentColor={colors.accent} />

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
    <ServiceScreen accentColor={colors.accent} title="Мой рейс" subtitle="" backLabel="Назад" onBack={() => navigation.goBack()}>
      <View style={styles.heroBlock}>
        <Text style={styles.heroRoute}>{`${trip?.fromCity || '-'} → ${trip?.toCity || '-'}`}</Text>
        <Text style={styles.heroText}>{statusLabels[trip?.status] || 'Рейс обновляется'}</Text>
      </View>

      <ServiceCard>
        <InlineLabel label="Статус" value={statusLabels[trip?.status] || 'Рейс'} accentColor={colors.accent} />
        <InlineLabel label="Выезд" value={formatIntercityDateTime(trip?.departureAt)} />
        <InlineLabel label="Цена за место" value={`${Math.round(Number(trip?.pricePerSeat || 0))} тг`} />
        <InlineLabel label="Свободно мест" value={`${freeSeatsLeft} из ${seatCapacityTotal}`} accentColor={colors.accent} />
        <InlineLabel label="Салон" value={trip?.womenOnly ? 'Женский' : 'Любой'} />
        <InlineLabel label="Багаж" value={trip?.baggageSpace ? 'Есть место' : 'Без багажа'} />
        <InlineLabel label="Животные" value={trip?.allowAnimals ? 'Можно' : 'Нельзя'} />
        {trip?.comment ? <InlineLabel label="Комментарий" value={trip.comment} /> : null}
      </ServiceCard>

      {canEditTrip ? (
        <ServiceCard compact>
          <Text style={styles.sectionTitle}>Места вне приложения</Text>
          <Text style={styles.seatsHint}>
            Взяли кого-то на вокзале или по звонку? Отметьте здесь, чтобы в приложении никто не забронировал занятое место.
          </Text>
          <View style={styles.seatsRow}>
            <TouchableOpacity
              style={[styles.stepperBtn, (offlineSeats <= 0 || savingSeats) && styles.stepperBtnDisabled]}
              onPress={() => saveOfflineSeats(offlineSeats - 1)}
              disabled={offlineSeats <= 0 || savingSeats}
              accessibilityRole="button"
              accessibilityLabel="Освободить одно место"
              hitSlop={4}
            >
              <Ionicons name="remove" size={22} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.seatsValueBox}>
              <Text style={styles.seatsValue}>{offlineSeats}</Text>
              <Text style={styles.seatsValueLabel}>занято вне приложения</Text>
            </View>
            <TouchableOpacity
              style={[styles.stepperBtn, (offlineSeats >= maxOfflineSeats || savingSeats) && styles.stepperBtnDisabled]}
              onPress={() => saveOfflineSeats(offlineSeats + 1)}
              disabled={offlineSeats >= maxOfflineSeats || savingSeats}
              accessibilityRole="button"
              accessibilityLabel="Занять одно место"
              hitSlop={4}
            >
              <Ionicons name="add" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          {freeSeatsLeft > 0 ? (
            <SecondaryButton title="Машина заполнена" onPress={() => saveOfflineSeats(maxOfflineSeats)} />
          ) : (
            <Text style={styles.fullText}>Свободных мест нет — забронировать рейс в приложении больше нельзя.</Text>
          )}
        </ServiceCard>
      ) : null}

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
        {activeBookings.length ? (
          activeBookings.map((booking: any) => (
            <View key={booking.id} style={styles.bookingCard}>
              <View style={styles.bookingInfo}>
                <Text style={styles.bookingName}>{booking.passenger?.fullName || booking.passenger?.user?.phone || 'Пассажир'}</Text>
                <Text style={styles.bookingMeta}>
                  {booking.seatsBooked} мест • {Math.round(Number(booking.totalPrice || 0))} тг
                </Text>
                <Text style={styles.bookingMeta}>Телефон: {booking.passenger?.user?.phone || '-'}</Text>
              </View>
              {canEditTrip && REMOVABLE_BOOKING_STATUSES.includes(booking.status) ? (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => confirmRemoveBooking(booking)}
                  accessibilityRole="button"
                  accessibilityLabel={`Убрать пассажира ${booking.passenger?.fullName || ''}`.trim()}
                >
                  <Text style={styles.removeBtnText}>Убрать</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Пока никто не забронировал этот рейс.</Text>
        )}
      </ServiceCard>

      {nextStatusMap[trip?.status] ? (
        <PrimaryButton title={nextStatusMap[trip?.status]?.label || 'Следующий этап'} onPress={advanceStatus} accentColor={colors.accent} />
      ) : null}
      {trip?.status && trip.status !== 'COMPLETED' && trip.status !== 'CANCELED' ? (
        <SecondaryButton title="Отменить рейс" onPress={confirmCancel} />
      ) : null}

      <DarkAlertModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        primaryLabel={
          modal.primaryMode === 'cancel-trip'
            ? 'Отменить рейс'
            : modal.primaryMode === 'remove-booking'
              ? 'Убрать'
              : 'Понятно'
        }
        secondaryLabel={modal.primaryMode ? 'Не сейчас' : undefined}
        primaryVariant={modal.primaryMode ? 'danger' : 'default'}
        onPrimary={() => {
          if (modal.primaryMode === 'cancel-trip') {
            cancelTrip().catch(() => null);
            return;
          }
          if (modal.primaryMode === 'remove-booking' && modal.bookingId) {
            removeBooking(modal.bookingId).catch(() => null);
            return;
          }
          setModal({ visible: false, title: '', message: '' });
        }}
        onSecondary={
          modal.primaryMode
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
  selectField: {
    backgroundColor: colors.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  fieldLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  fieldValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  fieldValueSmall: {
    color: colors.text,
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
    backgroundColor: colors.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
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
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tripChatButtonText: {
    color: colors.infoTextSoft,
    fontSize: 13,
    fontWeight: '800',
  },
  preferenceRow: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },
  bookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  bookingInfo: {
    flex: 1,
  },
  removeBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSurface,
  },
  removeBtnText: {
    color: colors.dangerText,
    fontSize: 13,
    fontWeight: '800',
  },
  seatsHint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: -4,
    marginBottom: 14,
  },
  seatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  seatsValueBox: {
    flex: 1,
    alignItems: 'center',
  },
  seatsValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  seatsValueLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  fullText: {
    color: colors.accentText,
    fontSize: 13,
    fontWeight: '700',
  },
  bookingName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  bookingMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 2,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
