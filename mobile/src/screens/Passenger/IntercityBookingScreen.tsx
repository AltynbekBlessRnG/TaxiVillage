import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
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
  const { tripId, fromCity, toCity, departureAt, driverName, car, pricePerSeat, seatCapacity, seatsRemaining } = route.params;
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
      subtitle="Бронь места или полного салона в опубликованном рейсе."
      backLabel="К предложениям"
      onBack={() => navigation.goBack()}
    >
      <ServiceCard>
        <InlineLabel label="Маршрут" value={`${fromCity} -> ${toCity}`} />
        <InlineLabel label="Водитель" value={driverName} />
        <InlineLabel label="Авто" value={car} />
        <InlineLabel label="Выезд" value={new Date(departureAt).toLocaleString()} />
        <InlineLabel label="Цена за место" value={`${pricePerSeat} тг`} accentColor="#38BDF8" />
        <InlineLabel label="Свободно мест" value={`${seatsRemaining} из ${seatCapacity}`} />
      </ServiceCard>

      <ServiceCard compact>
        <ChipRow items={['1 место', '2 места', 'Полный салон']} />
        <View style={styles.typeRow}>
          <PrimaryButton title="По местам" onPress={() => setBookingType('SEAT')} accentColor={bookingType === 'SEAT' ? '#38BDF8' : '#F4F4F5'} />
          <PrimaryButton title="Полный салон" onPress={() => setBookingType('FULL_CABIN')} accentColor={bookingType === 'FULL_CABIN' ? '#38BDF8' : '#F4F4F5'} />
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
        <InlineLabel label="Итого" value={`${Math.round(total)} тг`} accentColor="#38BDF8" />
      </ServiceCard>

      <PrimaryButton
        title={loading ? 'Бронируем...' : 'Забронировать место'}
        onPress={createOrder}
      />
    </ServiceScreen>
  );
};

const styles = StyleSheet.create({
  typeRow: {
    gap: 10,
    marginBottom: 12,
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
});
