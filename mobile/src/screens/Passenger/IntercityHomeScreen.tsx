import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { DarkAlertModal } from '../../components/DarkAlertModal';
import { OptionPickerModal } from '../../components/OptionPickerModal';
import { ServiceCard, ServiceScreen } from '../../components/ServiceScreen';
import {
  buildIntercityDateOptions,
  composeIntercityDepartureAt,
  INTERCITY_CITIES,
  INTERCITY_TIME_OPTIONS,
} from '../../constants/intercity';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityHome'>;

const seatOptions = ['1', '2', '3', '4'];
const baggageOptions = ['Без багажа', 'Ручная кладь', '1 чемодан', '2 чемодана'];

export const IntercityHomeScreen: React.FC<Props> = ({ navigation }) => {
  const dateOptions = useMemo(() => buildIntercityDateOptions(10), []);
  const defaultDate = dateOptions[1]?.value || dateOptions[0]?.value;
  const defaultTime = '09:00';
  const [fromCity, setFromCity] = useState('Алматы');
  const [toCity, setToCity] = useState('Астана');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [seats, setSeats] = useState('2');
  const [baggage, setBaggage] = useState('1 чемодан');
  const [price, setPrice] = useState('18000');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [activeBooking, setActiveBooking] = useState<any>(null);
  const [picker, setPicker] = useState<'from' | 'to' | 'date' | 'time' | null>(null);
  const [modal, setModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: '',
  });

  const selectedDateLabel =
    dateOptions.find((option) => option.value === date)?.label || 'Выберите дату';

  const loadCurrentIntercity = useCallback(async () => {
    try {
      const [ordersRes, bookingsRes] = await Promise.all([
        apiClient.get('/intercity-orders/my').catch(() => ({ data: [] })),
        apiClient.get('/intercity-bookings/my').catch(() => ({ data: [] })),
      ]);
      const orders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
      const bookings = Array.isArray(bookingsRes.data) ? bookingsRes.data : [];
      setActiveOrder(
        orders.find((item: any) =>
          ['SEARCHING_DRIVER', 'CONFIRMED', 'DRIVER_EN_ROUTE', 'BOARDING', 'IN_PROGRESS'].includes(item.status),
        ) ?? null,
      );
      setActiveBooking(
        bookings.find((item: any) => ['CONFIRMED', 'BOARDING', 'IN_PROGRESS'].includes(item.status)) ?? null,
      );
    } catch {
      setActiveOrder(null);
      setActiveBooking(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCurrentIntercity().catch(() => null);
      return undefined;
    }, [loadCurrentIntercity]),
  );

  const validateRoute = () => {
    if (!fromCity || !toCity) {
      throw new Error('Выберите маршрут');
    }
    if (fromCity === toCity) {
      throw new Error('Города отправления и прибытия должны отличаться');
    }
  };

  const openOffers = () => {
    try {
      validateRoute();
      navigation.navigate('IntercityOffers', {
        fromCity,
        toCity,
        date,
        time,
        seats,
        baggage,
        maxPrice: price,
        comment,
      });
    } catch (error: any) {
      setModal({
        visible: true,
        title: 'Межгород',
        message: error?.message || 'Проверьте форму',
      });
    }
  };

  const createProposal = async () => {
    setLoading(true);
    try {
      validateRoute();
      const departureAt = composeIntercityDepartureAt(date, time);
      const response = await apiClient.post('/intercity-orders', {
        fromCity,
        toCity,
        departureAt,
        seats: Math.max(Number(seats || 1), 1),
        baggage: baggage === 'Без багажа' ? undefined : baggage,
        comment: comment.trim() || undefined,
        price: Math.max(Number(price || 0), 0),
      });
      navigation.navigate('IntercityOrderStatus', { orderId: response.data.id });
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Не удалось создать заявку';
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
      accentColor="#38BDF8"
      title="Межгород"
      subtitle=""
      backLabel="К такси"
      onBack={() => navigation.goBack()}
    >
      {activeOrder ? (
        <ServiceCard compact>
          <Text style={styles.activeEyebrow}>Активная заявка</Text>
          <Text style={styles.activeRoute}>{`${activeOrder.fromCity} → ${activeOrder.toCity}`}</Text>
          <Text style={styles.activeMeta}>Открой заявку, чтобы посмотреть статус или отменить ее.</Text>
          <TouchableOpacity
            style={styles.openActiveButton}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('IntercityOrderStatus', { orderId: activeOrder.id })}
          >
            <Text style={styles.openActiveButtonText}>Открыть заявку</Text>
          </TouchableOpacity>
        </ServiceCard>
      ) : null}

      {activeBooking ? (
        <ServiceCard compact>
          <Text style={styles.activeEyebrow}>Активная бронь</Text>
          <Text style={styles.activeRoute}>{`${activeBooking.trip?.fromCity || '-'} → ${activeBooking.trip?.toCity || '-'}`}</Text>
          <Text style={styles.activeMeta}>Бронь уже создана. Открой, чтобы посмотреть поездку.</Text>
          <TouchableOpacity
            style={styles.openActiveButton}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('IntercityTripStatus', { bookingId: activeBooking.id })}
          >
            <Text style={styles.openActiveButtonText}>Открыть бронь</Text>
          </TouchableOpacity>
        </ServiceCard>
      ) : null}

      <ServiceCard compact>
        <View style={styles.routeColumn}>
          <TouchableOpacity style={styles.selectField} activeOpacity={0.9} onPress={() => setPicker('from')}>
            <Text style={styles.fieldLabel}>Откуда</Text>
            <Text style={styles.fieldValue}>{fromCity}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.swapButton} activeOpacity={0.9} onPress={() => {
            const nextFrom = toCity;
            const nextTo = fromCity;
            setFromCity(nextFrom);
            setToCity(nextTo);
          }}>
            <Text style={styles.swapButtonText}>⇅</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.selectField} activeOpacity={0.9} onPress={() => setPicker('to')}>
            <Text style={styles.fieldLabel}>Куда</Text>
            <Text style={styles.fieldValue}>{toCity}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <TouchableOpacity style={[styles.selectField, styles.halfField]} activeOpacity={0.9} onPress={() => setPicker('date')}>
            <Text style={styles.fieldLabel}>Дата</Text>
            <Text style={styles.fieldValueSmall}>{selectedDateLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.selectField, styles.halfField]} activeOpacity={0.9} onPress={() => setPicker('time')}>
            <Text style={styles.fieldLabel}>Время</Text>
            <Text style={styles.fieldValue}>{time}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Места</Text>
        <View style={styles.choiceRow}>
          {seatOptions.map((option) => {
            const active = seats === option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.choiceChip, active && styles.choiceChipActive]}
                activeOpacity={0.9}
                onPress={() => setSeats(option)}
              >
                <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Багаж</Text>
        <View style={styles.choiceRow}>
          {baggageOptions.map((option) => {
            const active = baggage === option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.choiceWideChip, active && styles.choiceChipActive]}
                activeOpacity={0.9}
                onPress={() => setBaggage(option)}
              >
                <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          keyboardType="number-pad"
          placeholder="Цена"
          placeholderTextColor="#71717A"
        />
        <TextInput
          style={[styles.input, styles.commentInput]}
          value={comment}
          onChangeText={setComment}
          placeholder="Комментарий"
          placeholderTextColor="#71717A"
          multiline
        />
      </ServiceCard>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.ctaButton, styles.ctaGhost]} activeOpacity={0.9} onPress={openOffers}>
          <Text style={styles.ctaGhostText}>Показать рейсы</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ctaButton, styles.ctaPrimary, loading && styles.ctaPrimaryDisabled]}
          activeOpacity={0.9}
          onPress={() => {
            if (!loading) {
              createProposal().catch?.(() => null);
            }
          }}
        >
          <Text style={styles.ctaPrimaryText}>{loading ? 'Создаем...' : 'Оставить заявку'}</Text>
        </TouchableOpacity>
      </View>

      <OptionPickerModal
        visible={picker === 'from'}
        title="Выберите город отправления"
        options={INTERCITY_CITIES.map((city) => ({ value: city, label: city }))}
        selectedValue={fromCity}
        onSelect={setFromCity}
        onClose={() => setPicker(null)}
      />
      <OptionPickerModal
        visible={picker === 'to'}
        title="Выберите город прибытия"
        options={INTERCITY_CITIES.map((city) => ({ value: city, label: city }))}
        selectedValue={toCity}
        onSelect={setToCity}
        onClose={() => setPicker(null)}
      />
      <OptionPickerModal
        visible={picker === 'date'}
        title="Выберите дату"
        options={dateOptions}
        selectedValue={date}
        onSelect={setDate}
        onClose={() => setPicker(null)}
      />
      <OptionPickerModal
        visible={picker === 'time'}
        title="Выберите время"
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
};

const styles = StyleSheet.create({
  routeColumn: {
    gap: 12,
    marginBottom: 14,
  },
  selectField: {
    backgroundColor: '#0B0B0E',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  halfField: {
    flex: 1,
  },
  fieldLabel: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  fieldValue: {
    color: '#F4F4F5',
    fontSize: 18,
    fontWeight: '800',
  },
  fieldValueSmall: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  swapButton: {
    alignSelf: 'flex-end',
    width: 42,
    height: 42,
    marginTop: -2,
    marginBottom: -6,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swapButtonText: {
    color: '#CBE7FF',
    fontSize: 18,
    fontWeight: '900',
  },
  sectionLabel: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  choiceChip: {
    minWidth: 52,
    backgroundColor: '#0B0B0E',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  choiceWideChip: {
    backgroundColor: '#0B0B0E',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  choiceChipActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#0F172A',
  },
  choiceText: {
    color: '#D4D4D8',
    fontSize: 14,
    fontWeight: '700',
  },
  choiceTextActive: {
    color: '#DBF0FF',
  },
  input: {
    backgroundColor: '#0B0B0E',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: '#F4F4F5',
    fontSize: 16,
    marginBottom: 12,
  },
  commentInput: {
    minHeight: 96,
    textAlignVertical: 'top',
    marginBottom: 0,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ctaButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaGhost: {
    borderWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#121216',
  },
  ctaGhostText: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
  },
  ctaPrimary: {
    backgroundColor: '#38BDF8',
  },
  ctaPrimaryDisabled: {
    opacity: 0.72,
  },
  ctaPrimaryText: {
    color: '#04131A',
    fontSize: 15,
    fontWeight: '900',
  },
  activeEyebrow: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  activeRoute: {
    color: '#F4F4F5',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  activeMeta: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  openActiveButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openActiveButtonText: {
    color: '#DBF0FF',
    fontSize: 14,
    fontWeight: '800',
  },
});
