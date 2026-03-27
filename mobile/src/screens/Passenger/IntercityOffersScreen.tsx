import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { InlineLabel, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityOffers'>;

export const IntercityOffersScreen: React.FC<Props> = ({ navigation, route }) => {
  const { fromCity, toCity, date, seats, baggage } = route.params;
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<any[]>([]);

  useEffect(() => {
    apiClient
      .get('/intercity-trips/public', {
        params: {
          fromCity,
          toCity,
        },
      })
      .then((response) => setOffers(response.data))
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
  }, [fromCity, toCity]);

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
      title={`${fromCity} -> ${toCity}`}
      subtitle="Список междугородних вариантов с водителем, временем и ценой."
      backLabel="К поиску"
      onBack={() => navigation.goBack()}
    >
      <ServiceCard compact>
        <InlineLabel label="Дата" value={date} />
        <InlineLabel label="Места" value={seats} />
        <InlineLabel label="Багаж" value={baggage} />
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
            })
          }
        >
          <View style={styles.offerTop}>
            <Text style={styles.offerDriver}>{offer.driver?.fullName || offer.driver?.user?.phone || 'Водитель'}</Text>
            <Text style={styles.offerPrice}>{Math.round(Number(offer.pricePerSeat || 0))} тг</Text>
          </View>
          <Text style={styles.offerCar}>
            {[offer.carMake, offer.carModel, offer.carColor].filter(Boolean).join(' • ') || 'Авто не заполнено'}
          </Text>
          <Text style={styles.offerTime}>
            Выезд: {new Date(offer.departureAt).toLocaleString()} • Мест: {Number(
              offer.seatsRemaining ?? offer.seatCapacity ?? 0,
            )} из {offer.seatCapacity}
          </Text>
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
    marginBottom: 8,
  },
  offerDriver: {
    color: '#F4F4F5',
    fontSize: 18,
    fontWeight: '900',
  },
  offerPrice: {
    color: '#38BDF8',
    fontWeight: '900',
  },
  offerCar: {
    color: '#D4D4D8',
    marginBottom: 4,
  },
  offerTime: {
    color: '#A1A1AA',
    fontSize: 13,
  },
  emptyText: {
    color: '#A1A1AA',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
});
