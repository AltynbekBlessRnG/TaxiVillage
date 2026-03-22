import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  InlineLabel,
  PrimaryButton,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityBooking'>;

export const IntercityBookingScreen: React.FC<Props> = ({ navigation, route }) => {
  const { fromCity, toCity, date, driverName, car, price, departureTime } = route.params;

  return (
    <ServiceScreen
      accentColor="#38BDF8"
      eyebrow="Бронь"
      title="Подтверждение поездки"
      subtitle="Эта ветка готовит отдельный booking contract для межгорода, не смешанный с instant taxi."
      backLabel="К предложениям"
      onBack={() => navigation.goBack()}
    >
      <ServiceCard>
        <InlineLabel label="Маршрут" value={`${fromCity} -> ${toCity}`} />
        <InlineLabel label="Водитель" value={driverName} />
        <InlineLabel label="Авто" value={car} />
        <InlineLabel label="Выезд" value={`${date}, ${departureTime}`} />
        <InlineLabel label="Цена" value={`${price} тг`} accentColor="#38BDF8" />
      </ServiceCard>

      <PrimaryButton
        title="Забронировать место"
        onPress={() =>
          navigation.navigate('IntercityTripStatus', {
            fromCity,
            toCity,
            driverName,
            departureTime,
          })
        }
      />
    </ServiceScreen>
  );
};
