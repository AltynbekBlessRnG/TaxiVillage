import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import {
  ChipRow,
  InlineLabel,
  PrimaryButton,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityBooking'>;

export const IntercityBookingScreen: React.FC<Props> = ({ navigation, route }) => {
  const {
    tripId,
    fromCity,
    toCity,
    departureAt,
    driverName,
    car,
    pricePerSeat,
    seatCapacity,
    seatsRemaining,
    stops,
    womenOnly,
    baggageSpace,
    allowAnimals,
  } = route.params;
  const [loading, setLoading] = useState(false);
  const [bookingType, setBookingType] = useState<'SEAT' | 'FULL_CABIN'>('SEAT');
  const [seatsBooked, setSeatsBooked] = useState('1');
  const [comment, setComment] = useState('');

  const total = useMemo(() => {
    const parsedSeats = bookingType === 'FULL_CABIN' ? seatsRemaining : Math.max(Number(seatsBooked || 1), 1);
    return parsedSeats * Number(pricePerSeat || 0);
  }, [bookingType, pricePerSeat, seatsBooked, seatsRemaining]);

  const createOrder = async () => {
    setLoading(true);
    try {
      const response = await apiClient.post(`/intercity-trips/${tripId}/book`, {
        bookingType,
        seatsBooked: bookingType === 'FULL_CABIN' ? seatsRemaining : Math.max(Number(seatsBooked || 1), 1),
        comment: comment.trim() || undefined,
      });

      navigation.navigate('IntercityTripStatus', { bookingId: response.data.id });
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось забронировать поездку';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ServiceScreen
      accentColor="#38BDF8"
      eyebrow="Бронь"
      title="Подтверждение поездки"
      subtitle="Подтверди формат поездки, количество мест и отправь водителю аккуратную бронь."
      backLabel="К предложениям"
      onBack={() => navigation.goBack()}
    >
      <View style={styles.heroBlock}>
        <Text style={styles.heroRoute}>{fromCity} → {toCity}</Text>
        <Text style={styles.heroText}>
          {driverName} • {new Date(departureAt).toLocaleString('ru-RU', {
            day: '2-digit',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>

      <ServiceCard>
        <InlineLabel label="Маршрут" value={`${fromCity} -> ${toCity}`} />
        <InlineLabel label="Водитель" value={driverName} />
        <InlineLabel label="Авто" value={car} />
        <InlineLabel label="Выезд" value={new Date(departureAt).toLocaleString()} />
        <InlineLabel label="Цена за место" value={`${pricePerSeat} тг`} accentColor="#38BDF8" />
        <InlineLabel label="Свободно мест" value={`${seatsRemaining} из ${seatCapacity}`} />
        <InlineLabel label="Салон" value={womenOnly ? 'Только женщины' : 'Любой'} />
        <InlineLabel label="Багаж" value={baggageSpace ? 'Есть место для багажа' : 'Без багажа'} />
        <InlineLabel label="Животные" value={allowAnimals ? 'Разрешены' : 'Не допускаются'} />
        {stops.length ? <InlineLabel label="Остановки" value={stops.join(' • ')} /> : null}
      </ServiceCard>

      <ServiceCard compact>
        <ChipRow items={['1 место', '2 места', 'Полный салон']} />
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.modeCard, bookingType === 'SEAT' && styles.modeCardActive]}
            onPress={() => setBookingType('SEAT')}
          >
            <Text style={[styles.modeCardTitle, bookingType === 'SEAT' && styles.modeCardTitleActive]}>По местам</Text>
            <Text style={[styles.modeCardText, bookingType === 'SEAT' && styles.modeCardTextActive]}>
              Подходит, если нужен 1-2 места
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeCard, bookingType === 'FULL_CABIN' && styles.modeCardActive]}
            onPress={() => setBookingType('FULL_CABIN')}
          >
            <Text style={[styles.modeCardTitle, bookingType === 'FULL_CABIN' && styles.modeCardTitleActive]}>Полный салон</Text>
            <Text style={[styles.modeCardText, bookingType === 'FULL_CABIN' && styles.modeCardTextActive]}>
              Вся машина под тебя
            </Text>
          </TouchableOpacity>
        </View>
        {bookingType === 'SEAT' ? (
          <TextInput
            style={styles.input}
            value={seatsBooked}
            onChangeText={setSeatsBooked}
            keyboardType="number-pad"
            placeholder="Количество мест"
            placeholderTextColor="#71717A"
          />
        ) : null}
        <TextInput
          style={[styles.input, styles.commentInput]}
          value={comment}
          onChangeText={setComment}
          placeholder="Комментарий для водителя"
          placeholderTextColor="#71717A"
          multiline
        />
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Итого к брони</Text>
          <Text style={styles.totalValue}>{Math.round(total)} тг</Text>
        </View>
      </ServiceCard>

      <PrimaryButton
        title={loading ? 'Бронируем...' : 'Забронировать место'}
        onPress={createOrder}
      />
    </ServiceScreen>
  );
};

const styles = StyleSheet.create({
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
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
  },
  typeRow: {
    gap: 10,
    marginBottom: 12,
  },
  modeCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 14,
  },
  modeCardActive: {
    backgroundColor: '#082F49',
    borderColor: '#38BDF8',
  },
  modeCardTitle: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  modeCardTitleActive: {
    color: '#E0F2FE',
  },
  modeCardText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  modeCardTextActive: {
    color: '#BAE6FD',
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
  totalCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
  },
  totalLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  totalValue: {
    color: '#E0F2FE',
    fontSize: 24,
    fontWeight: '900',
  },
});
