import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { DarkAlertModal } from '../../components/DarkAlertModal';
import {
  ChipRow,
  InlineLabel,
  PrimaryButton,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';
import { formatCancelRecord, formatTripDeparture } from '../../constants/intercity';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityBooking'>;

export const IntercityBookingScreen: React.FC<Props> = ({ navigation, route }) => {
  const {
    tripId,
    fromCity,
    toCity,
    departureAt,
    departWhenFull,
    driverName,
    driverCancelCount,
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
  const [modal, setModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: '',
  });

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
      setModal({
        visible: true,
        title: 'Ошибка',
        message: Array.isArray(message) ? message.join(', ') : message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ServiceScreen
      accentColor={colors.accent}
      title="Подтверждение поездки"
      subtitle=""
      backLabel="К предложениям"
      onBack={() => navigation.goBack()}
    >
      <View style={styles.heroBlock}>
        <Text style={styles.heroRoute}>{fromCity} → {toCity}</Text>
        <Text style={styles.heroText}>{driverName} • {formatTripDeparture(departureAt, departWhenFull)}</Text>
      </View>

      <ServiceCard>
        <InlineLabel label="Маршрут" value={`${fromCity} → ${toCity}`} />
        <InlineLabel label="Водитель" value={driverName} />
        {formatCancelRecord(driverCancelCount) ? (
          <InlineLabel
            label="Отмены"
            value={formatCancelRecord(driverCancelCount) || ''}
            accentColor={colors.warningText}
          />
        ) : null}
        <InlineLabel label="Авто" value={car} />
        <InlineLabel label="Выезд" value={formatTripDeparture(departureAt, departWhenFull)} />
        <InlineLabel label="Цена за место" value={`${pricePerSeat} тг`} accentColor={colors.accent} />
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
            placeholderTextColor={colors.textTertiary}
          />
        ) : null}
        <TextInput
          style={[styles.input, styles.commentInput]}
          value={comment}
          onChangeText={setComment}
          placeholder="Комментарий для водителя"
          placeholderTextColor={colors.textTertiary}
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
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  typeRow: {
    gap: 10,
    marginBottom: 12,
  },
  modeCard: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  modeCardActive: {
    backgroundColor: colors.accentSurface,
    borderColor: colors.accent,
  },
  modeCardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  modeCardTitleActive: {
    color: colors.accentTextSoft,
  },
  modeCardText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  modeCardTextActive: {
    color: colors.accentText,
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
  totalCard: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  totalLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  totalValue: {
    color: colors.accentTextSoft,
    fontSize: 24,
    fontWeight: '900',
  },
});
