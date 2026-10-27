import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { OptionPickerModal } from '../../components/OptionPickerModal';
import { SecondaryButton, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';
import {
  buildIntercityDateOptions,
  formatCancelRecord,
  formatTripDeparture,
} from '../../constants/intercity';
import { colors } from '../../theme/colors';

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
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ServiceScreen
      accentColor={colors.accent}
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
              placeholderTextColor={colors.textTertiary}
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
              placeholderTextColor={colors.textTertiary}
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
              departWhenFull: Boolean(offer.departWhenFull),
              driverCancelCount: Number(offer.driverCancelCount || 0),
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
              <Text style={styles.departureText}>{formatTripDeparture(offer.departureAt, offer.departWhenFull)}</Text>
            </View>
            <Text style={styles.priceText}>{Math.round(Number(offer.pricePerSeat || 0))} тг</Text>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.bottomMeta}>
              <Text style={styles.driverText}>{offer.driver?.fullName || offer.driver?.user?.phone || 'Водитель'}</Text>
              <Text style={styles.carText}>
                {[offer.carMake, offer.carModel, offer.carColor].filter(Boolean).join(' • ') || 'Авто не указано'}
              </Text>
              {formatCancelRecord(offer.driverCancelCount) ? (
                <Text style={styles.cancelRecord}>{formatCancelRecord(offer.driverCancelCount)}</Text>
              ) : null}
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
  cancelRecord: {
    color: colors.warningText,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  filterField: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  flexTwo: {
    flex: 2,
  },
  filterLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  filterValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  filterInput: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    padding: 0,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 8,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  offerCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  departureText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  priceText: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '900',
  },
  driverText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  carText: {
    color: colors.textSecondary,
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
    color: colors.accentTextSoft,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
});
