import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { InlineLabel, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityOffers'>;

export const IntercityOffersScreen: React.FC<Props> = ({ navigation, route }) => {
  const { fromCity, toCity, date, seats, baggage, minPrice, maxPrice, womenOnly, baggageRequired, noAnimals } = route.params;
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<any[]>([]);
  const [maxPriceFilter, setMaxPriceFilter] = useState(maxPrice || '');
  const [seatsFilter, setSeatsFilter] = useState(seats || '1');

  const filterSummary = useMemo(
    () => [
      womenOnly ? 'Только женский салон' : 'Любой салон',
      baggageRequired ? 'Есть место для багажа' : 'Багаж не важен',
      noAnimals ? 'Без животных' : 'Животные допустимы',
    ],
    [baggageRequired, noAnimals, womenOnly],
  );

  useEffect(() => {
    setLoading(true);
    apiClient
      .get('/intercity-trips/public', {
        params: {
          fromCity,
          toCity,
          minPrice: minPrice || undefined,
          maxPrice: maxPriceFilter || undefined,
          seatsRequired: seatsFilter || undefined,
          baggageRequired: baggageRequired || undefined,
          womenOnly: womenOnly || undefined,
          noAnimals: noAnimals || undefined,
        },
      })
      .then((response) => setOffers(response.data))
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
  }, [baggageRequired, fromCity, maxPriceFilter, minPrice, noAnimals, seatsFilter, toCity, womenOnly]);

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
      eyebrow="Предложения"
      title={`Поездки в ${toCity}`}
      subtitle="Показываем все ближайшие поездки по этому направлению начиная с текущего времени."
      backLabel="К поиску"
      onBack={() => navigation.goBack()}
    >
      <View style={styles.heroBlock}>
        <Text style={styles.heroRoute}>{fromCity} → {toCity}</Text>
        <Text style={styles.heroText}>
          Смотри ближайшие выезды, сравни условия и выбирай водителя под свой сценарий поездки.
        </Text>
      </View>

      <ServiceCard compact>
        <InlineLabel label="Дата" value={date} />
        <InlineLabel label="Места" value={seats} />
        <InlineLabel label="Багаж" value={baggage} />
      </ServiceCard>

      <ServiceCard compact>
        <Text style={styles.filterTitle}>Фильтры</Text>
        <TextInput
          style={styles.input}
          value={seatsFilter}
          onChangeText={setSeatsFilter}
          keyboardType="number-pad"
          placeholder="Сколько мест нужно"
          placeholderTextColor="#71717A"
        />
        <TextInput
          style={styles.input}
          value={maxPriceFilter}
          onChangeText={setMaxPriceFilter}
          keyboardType="number-pad"
          placeholder="Максимальная цена за место"
          placeholderTextColor="#71717A"
        />
        <View style={styles.filterChips}>
          {filterSummary.map((item) => (
            <View key={item} style={styles.filterChip}>
              <Text style={styles.filterChipText}>{item}</Text>
            </View>
          ))}
        </View>
      </ServiceCard>

      {offers.length === 0 ? (
        <ServiceCard compact>
          <Text style={styles.emptyText}>Пока нет подходящих рейсов по этому маршруту. Попробуй изменить дату или направление.</Text>
        </ServiceCard>
      ) : null}

      {offers.map((offer) => (
        <TouchableOpacity
          key={offer.id}
          style={styles.offerCard}
          onPress={() =>
            navigation.navigate('IntercityBooking', {
              tripId: offer.id,
              fromCity,
              toCity,
              departureAt: offer.departureAt,
              driverName: offer.driver?.fullName || offer.driver?.user?.phone || 'Водитель',
              car:
                [offer.carMake, offer.carModel, offer.carColor].filter(Boolean).join(' • ') ||
                [offer.driver?.car?.make, offer.driver?.car?.model, offer.driver?.car?.color]
                  .filter(Boolean)
                  .join(' • ') ||
                'Авто не указано',
              pricePerSeat: String(Math.round(Number(offer.pricePerSeat || 0))),
              seatCapacity: Number(offer.seatCapacity || 0),
              seatsRemaining: Number(offer.seatsRemaining ?? offer.seatCapacity ?? 0),
              stops: Array.isArray(offer.stops) ? offer.stops : [],
              womenOnly: Boolean(offer.womenOnly),
              baggageSpace: Boolean(offer.baggageSpace),
              allowAnimals: Boolean(offer.allowAnimals),
            })
          }
        >
          <View style={styles.offerTop}>
            <View style={styles.offerTopLeft}>
              <Text style={styles.offerDriver}>{offer.driver?.fullName || offer.driver?.user?.phone || 'Водитель'}</Text>
              <Text style={styles.offerDeparture}>
                {new Date(offer.departureAt).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <Text style={styles.offerPrice}>{Math.round(Number(offer.pricePerSeat || 0))} тг</Text>
          </View>
          <View style={styles.routeLine}>
            <View style={styles.routePointRow}>
              <View style={[styles.routeDot, styles.routeDotFrom]} />
              <Text style={styles.routeText}>{fromCity}</Text>
            </View>
            <View style={styles.routeStem} />
            <View style={styles.routePointRow}>
              <View style={[styles.routeDot, styles.routeDotTo]} />
              <Text style={styles.routeText}>{toCity}</Text>
            </View>
          </View>
          <Text style={styles.offerCar}>
            {[offer.carMake, offer.carModel, offer.carColor].filter(Boolean).join(' • ') || 'Авто не заполнено'}
          </Text>
          <View style={styles.metaWrap}>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>
                {Number(offer.seatsRemaining ?? offer.seatCapacity ?? 0)} из {offer.seatCapacity} мест
              </Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{offer.womenOnly ? 'Женский салон' : 'Любой салон'}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{offer.baggageSpace ? 'Есть багаж' : 'Без багажа'}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{offer.allowAnimals ? 'Животные допустимы' : 'Без животных'}</Text>
            </View>
          </View>
          {Array.isArray(offer.stops) && offer.stops.length ? (
            <Text style={styles.offerMeta}>Остановки: {offer.stops.join(' • ')}</Text>
          ) : null}
        </TouchableOpacity>
      ))}
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
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
  },
  offerCard: {
    backgroundColor: '#18181B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 16,
    marginBottom: 12,
  },
  offerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  offerTopLeft: {
    flex: 1,
  },
  offerDriver: {
    color: '#F4F4F5',
    fontSize: 18,
    fontWeight: '900',
  },
  offerDeparture: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  offerPrice: {
    color: '#38BDF8',
    fontWeight: '900',
    fontSize: 18,
  },
  routeLine: {
    marginBottom: 12,
  },
  routePointRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeStem: {
    width: 1,
    height: 16,
    backgroundColor: '#334155',
    marginLeft: 6,
    marginVertical: 4,
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
  routeText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
  },
  offerCar: {
    color: '#D4D4D8',
    marginBottom: 10,
  },
  offerMeta: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 10,
    lineHeight: 18,
  },
  emptyText: {
    color: '#A1A1AA',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  filterTitle: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
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
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#082F49',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#0EA5E9',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipText: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '700',
  },
  metaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    backgroundColor: '#0F172A',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaPillText: {
    color: '#CBE7FF',
    fontSize: 12,
    fontWeight: '700',
  },
});
