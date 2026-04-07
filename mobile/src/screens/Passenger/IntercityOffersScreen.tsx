import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { OptionPickerModal } from '../../components/OptionPickerModal';
import { SecondaryButton, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';
import { buildIntercityDateOptions, formatIntercityDateTime } from '../../constants/intercity';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityOffers'>;

export const IntercityOffersScreen: React.FC<Props> = ({ navigation, route }) => {
  const dateOptions = useMemo(() => buildIntercityDateOptions(10), []);
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<any[]>([]);
  const [date, setDate] = useState(route.params.date);
  const [seats, setSeats] = useState(route.params.seats || '1');
  const [maxPriceDraft, setMaxPriceDraft] = useState(route.params.maxPrice || '');
  const [maxPrice, setMaxPrice] = useState(route.params.maxPrice || '');
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const loadOffers = useCallback(() => {
    setLoading(true);
    return apiClient
      .get('/intercity-trips/public', {
        params: {
          fromCity: route.params.fromCity,
          toCity: route.params.toCity,
          dateFrom: date,
          seatsRequired: Math.max(Number(seats || 1), 1),
          maxPrice: maxPrice ? Math.max(Number(maxPrice || 0), 0) : undefined,
        },
      })
      .then((response) => setOffers(Array.isArray(response.data) ? response.data : []))
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
  }, [date, maxPrice, route.params.fromCity, route.params.toCity, seats]);

  useEffect(() => {
    loadOffers().catch(() => null);
  }, [loadOffers]);

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
      title={`${route.params.fromCity} → ${route.params.toCity}`}
      subtitle=""
      backLabel="Назад"
      onBack={() => navigation.goBack()}
    >
      <ServiceCard compact>
        <View style={styles.filterRow}>
          <TouchableOpacity style={[styles.filterField, styles.flexTwo]} activeOpacity={0.9} onPress={() => setDatePickerVisible(true)}>
            <Text style={styles.filterLabel}>Дата</Text>
            <Text style={styles.filterValue}>
              {dateOptions.find((option) => option.value === date)?.label || date}
            </Text>
          </TouchableOpacity>
          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Места</Text>
            <TextInput
              style={styles.filterInput}
              value={seats}
              onChangeText={setSeats}
              keyboardType="number-pad"
              placeholderTextColor="#71717A"
            />
          </View>
          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>До</Text>
            <TextInput
              style={styles.filterInput}
              value={maxPriceDraft}
              onChangeText={setMaxPriceDraft}
              keyboardType="number-pad"
              placeholder="тг"
              placeholderTextColor="#71717A"
            />
          </View>
        </View>
        <SecondaryButton title="Применить" onPress={() => setMaxPrice(maxPriceDraft)} />
      </ServiceCard>

      {offers.length === 0 ? (
        <ServiceCard compact>
          <Text style={styles.emptyTitle}>Рейсов пока нет</Text>
          <Text style={styles.emptyText}>Измени дату или оставь заявку.</Text>
        </ServiceCard>
      ) : null}

      {offers.map((offer) => (
        <TouchableOpacity
          key={offer.id}
          style={styles.offerCard}
          activeOpacity={0.92}
          onPress={() =>
            navigation.navigate('IntercityBooking', {
              tripId: offer.id,
              fromCity: offer.fromCity,
              toCity: offer.toCity,
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
          <View style={styles.topRow}>
            <View style={styles.topMeta}>
              <Text style={styles.routeText}>{offer.fromCity} → {offer.toCity}</Text>
              <Text style={styles.departureText}>{formatIntercityDateTime(offer.departureAt)}</Text>
            </View>
            <Text style={styles.priceText}>{Math.round(Number(offer.pricePerSeat || 0))} тг</Text>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.bottomMeta}>
              <Text style={styles.driverText}>{offer.driver?.fullName || offer.driver?.user?.phone || 'Водитель'}</Text>
              <Text style={styles.carText}>
                {[offer.carMake, offer.carModel, offer.carColor].filter(Boolean).join(' • ') || 'Авто не указано'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaPill}>{Number(offer.seatsRemaining ?? offer.seatCapacity ?? 0)} мест</Text>
              <Text style={styles.metaPill}>{offer.womenOnly ? 'Женский' : 'Любой'}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}

      <OptionPickerModal
        visible={datePickerVisible}
        title="Дата рейса"
        options={dateOptions}
        selectedValue={date}
        onSelect={setDate}
        onClose={() => setDatePickerVisible(false)}
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
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  filterField: {
    flex: 1,
    backgroundColor: '#0B0B0E',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  flexTwo: {
    flex: 2,
  },
  filterLabel: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  filterValue: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '700',
  },
  filterInput: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '700',
    padding: 0,
  },
  emptyTitle: {
    color: '#F4F4F5',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 8,
  },
  emptyText: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 18,
  },
  offerCard: {
    backgroundColor: '#18181B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 16,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  topMeta: {
    flex: 1,
  },
  routeText: {
    color: '#F4F4F5',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  departureText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
  },
  priceText: {
    color: '#38BDF8',
    fontSize: 18,
    fontWeight: '900',
  },
  driverText: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
  },
  carText: {
    color: '#A1A1AA',
    fontSize: 13,
    marginTop: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-end',
  },
  bottomMeta: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-end',
  },
  metaPill: {
    color: '#CBE7FF',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
});
