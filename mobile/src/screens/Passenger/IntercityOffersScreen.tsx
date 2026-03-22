import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { InlineLabel, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityOffers'>;

const offers = [
  { id: 'offer-1', driverName: 'Аян', car: 'Camry 70', price: '18000', departureTime: '18:30' },
  { id: 'offer-2', driverName: 'Диас', car: 'Kia K5', price: '21000', departureTime: '19:15' },
  { id: 'offer-3', driverName: 'Максат', car: 'Hyundai Sonata', price: '19500', departureTime: '20:00' },
];

export const IntercityOffersScreen: React.FC<Props> = ({ navigation, route }) => {
  const { fromCity, toCity, date, seats, baggage } = route.params;

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

      {offers.map((offer) => (
        <TouchableOpacity
          key={offer.id}
          style={styles.offerCard}
          onPress={() =>
            navigation.navigate('IntercityBooking', {
              fromCity,
              toCity,
              date,
              driverName: offer.driverName,
              car: offer.car,
              price: offer.price,
              departureTime: offer.departureTime,
            })
          }
        >
          <View style={styles.offerTop}>
            <Text style={styles.offerDriver}>{offer.driverName}</Text>
            <Text style={styles.offerPrice}>{offer.price} тг</Text>
          </View>
          <Text style={styles.offerCar}>{offer.car}</Text>
          <Text style={styles.offerTime}>Выезд: {offer.departureTime}</Text>
        </TouchableOpacity>
      ))}
    </ServiceScreen>
  );
};

const styles = StyleSheet.create({
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
});
