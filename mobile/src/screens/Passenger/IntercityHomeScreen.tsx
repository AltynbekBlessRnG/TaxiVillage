import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import {
  ChipRow,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityHome'>;

export const IntercityHomeScreen: React.FC<Props> = ({ navigation }) => {
  const defaultDepartureAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const [fromCity, setFromCity] = useState('Алматы');
  const [toCity, setToCity] = useState('Алаколь');
  const [date, setDate] = useState(defaultDepartureAt);
  const [seats, setSeats] = useState('2');
  const [baggage, setBaggage] = useState('2 чемодана');
  const [price, setPrice] = useState('18000');
  const [comment, setComment] = useState('');
  const [stops, setStops] = useState('');
  const [womenOnly, setWomenOnly] = useState(false);
  const [baggageRequired, setBaggageRequired] = useState(true);
  const [noAnimals, setNoAnimals] = useState(false);
  const [popularRoutes, setPopularRoutes] = useState<any[]>([]);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [activeBooking, setActiveBooking] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadHome = useCallback(() => {
    return Promise.all([
      apiClient
        .get('/intercity-trips/popular-routes')
        .then((response) => setPopularRoutes(Array.isArray(response.data) ? response.data : []))
        .catch(() => setPopularRoutes([])),
      apiClient
        .get('/intercity-orders/my')
        .then((response) =>
          setActiveOrder(
            (Array.isArray(response.data) ? response.data : []).find((item: any) =>
              ['SEARCHING_DRIVER', 'CONFIRMED', 'DRIVER_EN_ROUTE', 'BOARDING', 'IN_PROGRESS'].includes(item.status),
            ) ?? null,
          ),
        )
        .catch(() => setActiveOrder(null)),
      apiClient
        .get('/intercity-bookings/my')
        .then((response) =>
          setActiveBooking(
            (Array.isArray(response.data) ? response.data : []).find((item: any) =>
              ['CONFIRMED', 'BOARDING', 'IN_PROGRESS'].includes(item.status),
            ) ?? null,
          ),
        )
        .catch(() => setActiveBooking(null)),
    ]).catch(() => null);
  }, []);

  useEffect(() => {
    loadHome().catch(() => null);
  }, [loadHome]);

  useFocusEffect(
    useCallback(() => {
      loadHome().catch(() => null);
      return undefined;
    }, [loadHome]),
  );

  const createProposal = async () => {
    setLoading(true);
    try {
      const departureAt = date.includes('T') ? `${date}:00.000Z` : new Date(date).toISOString();
      const response = await apiClient.post('/intercity-orders', {
        fromCity,
        toCity,
        departureAt,
        seats: Math.max(Number(seats || 1), 1),
        baggage: baggage.trim() || undefined,
        comment: comment.trim() || undefined,
        price: Math.max(Number(price || 0), 0),
        stops: stops
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        womenOnly,
        baggageRequired,
        noAnimals,
      });

      navigation.navigate('IntercityOrderStatus', { orderId: response.data.id });
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось создать предложение';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ServiceScreen
      accentColor="#38BDF8"
      eyebrow="Межгород"
      title="Поездки между городами"
      subtitle="Смотри рейсы, публикуй свою заявку и собирай поездку под себя без лишней суеты."
      backLabel="К такси"
      onBack={() => navigation.goBack()}
    >
      <View style={styles.heroBlock}>
        <Text style={styles.heroRoute}>{fromCity} → {toCity}</Text>
        <Text style={styles.heroText}>
          На завтра, на выходные или заранее. Межгород теперь работает как отдельный живой рынок предложений.
        </Text>
      </View>

      {activeOrder ? (
        <ServiceCard compact>
          <SectionTitle>Активная заявка</SectionTitle>
          <Text style={styles.activeText}>{`${activeOrder.fromCity} -> ${activeOrder.toCity}`}</Text>
          <PrimaryButton
            title="Открыть заявку"
            onPress={() => navigation.navigate('IntercityOrderStatus', { orderId: activeOrder.id })}
          />
        </ServiceCard>
      ) : null}

      {activeBooking ? (
        <ServiceCard compact>
          <SectionTitle>Активная бронь</SectionTitle>
          <Text style={styles.activeText}>{`${activeBooking.trip?.fromCity || '-'} -> ${activeBooking.trip?.toCity || '-'}`}</Text>
          <PrimaryButton
            title="Открыть бронь"
            onPress={() => navigation.navigate('IntercityTripStatus', { bookingId: activeBooking.id })}
          />
        </ServiceCard>
      ) : null}

      <ServiceCard>
        <SectionTitle>Маршрут</SectionTitle>
        <View style={styles.routePreview}>
          <View style={styles.routePointRow}>
            <View style={[styles.routeDot, styles.routeDotFrom]} />
            <Text style={styles.routePointText}>{fromCity}</Text>
          </View>
          <View style={styles.routeStem} />
          <View style={styles.routePointRow}>
            <View style={[styles.routeDot, styles.routeDotTo]} />
            <Text style={styles.routePointText}>{toCity}</Text>
          </View>
        </View>
        <TextInput style={styles.input} value={fromCity} onChangeText={setFromCity} placeholderTextColor="#71717A" />
        <TextInput style={styles.input} value={toCity} onChangeText={setToCity} placeholderTextColor="#71717A" />
        <TextInput style={styles.input} value={date} onChangeText={setDate} placeholderTextColor="#71717A" />
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.half]} value={seats} onChangeText={setSeats} placeholderTextColor="#71717A" />
          <TextInput style={[styles.input, styles.half]} value={baggage} onChangeText={setBaggage} placeholderTextColor="#71717A" />
        </View>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          keyboardType="number-pad"
          placeholder="Ваша цена"
          placeholderTextColor="#71717A"
        />
        <TextInput
          style={[styles.input, styles.commentInput]}
          value={comment}
          onChangeText={setComment}
          placeholder="Комментарий для водителей"
          placeholderTextColor="#71717A"
          multiline
        />
        <TextInput
          style={styles.input}
          value={stops}
          onChangeText={setStops}
          placeholder="Остановки по пути через запятую"
          placeholderTextColor="#71717A"
        />
      </ServiceCard>

      <ServiceCard compact>
        <SectionTitle>Предпочтения</SectionTitle>
        <View style={styles.preferenceRow}>
          <TouchableOpacity
            style={[styles.preferenceChip, womenOnly && styles.preferenceChipActive]}
            onPress={() => setWomenOnly((value) => !value)}
          >
            <Text style={[styles.preferenceChipText, womenOnly && styles.preferenceChipTextActive]}>
              Только женский салон
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.preferenceChip, baggageRequired && styles.preferenceChipActive]}
            onPress={() => setBaggageRequired((value) => !value)}
          >
            <Text style={[styles.preferenceChipText, baggageRequired && styles.preferenceChipTextActive]}>
              Нужен багаж
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.preferenceChip, noAnimals && styles.preferenceChipActive]}
            onPress={() => setNoAnimals((value) => !value)}
          >
            <Text style={[styles.preferenceChipText, noAnimals && styles.preferenceChipTextActive]}>
              Без животных
            </Text>
          </TouchableOpacity>
        </View>
        <ChipRow items={['Комфорт', 'Семейный багаж', 'Ночной выезд', 'Предзаказ']} />
      </ServiceCard>

      {popularRoutes.length ? (
        <ServiceCard compact>
          <SectionTitle>Популярные направления</SectionTitle>
          <View style={styles.popularList}>
            {popularRoutes.map((route) => (
          <TouchableOpacity
                key={`${route.fromCity}-${route.toCity}`}
                style={styles.popularRoute}
                onPress={() => {
                  setFromCity(route.fromCity);
                  setToCity(route.toCity);
                }}
              >
                <Text style={styles.popularRouteEyebrow}>Популярное направление</Text>
                <Text style={styles.popularRouteTitle}>{`${route.fromCity} -> ${route.toCity}`}</Text>
                <Text style={styles.popularRouteMeta}>{`Спрос ${route.demand} • Начиная с ближайших дат`}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ServiceCard>
      ) : null}

      <ServiceCard compact>
        <SectionTitle>Что показать в предложениях</SectionTitle>
        <ChipRow items={[
          womenOnly ? 'Ищу женский салон' : 'Любой салон',
          baggageRequired ? 'Нужен багаж' : 'Без багажа',
          noAnimals ? 'Без животных' : 'Животные ок',
        ]} />
      </ServiceCard>

      <PrimaryButton
        title="Показать предложения водителей"
        onPress={() =>
          navigation.navigate('IntercityOffers', {
            fromCity,
            toCity,
            date,
            seats,
            baggage,
            minPrice: '',
            maxPrice: price,
            womenOnly,
            baggageRequired,
            noAnimals,
          })
        }
      />
      <SecondaryButton title={loading ? 'Публикуем...' : 'Создать предложение'} onPress={createProposal} />
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
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  routePreview: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
    marginBottom: 12,
  },
  routePointRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeStem: {
    width: 1,
    height: 18,
    backgroundColor: '#334155',
    marginLeft: 6,
    marginVertical: 5,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  routeDotFrom: {
    backgroundColor: '#38BDF8',
  },
  routeDotTo: {
    backgroundColor: '#F97316',
  },
  routePointText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
  },
  half: {
    flex: 1,
  },
  commentInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  preferenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  preferenceChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  preferenceChipActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#082F49',
  },
  preferenceChipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  preferenceChipTextActive: {
    color: '#7DD3FC',
  },
  popularList: {
    gap: 10,
  },
  popularRoute: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E3A5F',
    borderRadius: 22,
    padding: 16,
  },
  popularRouteEyebrow: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  popularRouteTitle: {
    color: '#F4F4F5',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 6,
  },
  popularRouteMeta: {
    color: '#BFDBFE',
    fontSize: 13,
  },
  activeText: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
});
