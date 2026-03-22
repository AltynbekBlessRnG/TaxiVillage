import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  InlineLabel,
  PrimaryButton,
  SectionTitle,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityTripStatus'>;

export const IntercityTripStatusScreen: React.FC<Props> = ({ navigation, route }) => {
  const { fromCity, toCity, driverName, departureTime } = route.params;

  return (
    <ServiceScreen
      accentColor="#38BDF8"
      eyebrow="Межгород"
      title="Бронь подтверждена"
      subtitle="Здесь потом будет активный flow поездки: водитель выехал, посадка, в пути, завершено."
      backLabel="На главную"
      onBack={() => navigation.replace('PassengerHome', {})}
    >
      <ServiceCard>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Подтверждено</Text>
        </View>
        <InlineLabel label="Маршрут" value={`${fromCity} -> ${toCity}`} />
        <InlineLabel label="Водитель" value={driverName} />
        <InlineLabel label="Выезд" value={departureTime} accentColor="#38BDF8" />
      </ServiceCard>

      <ServiceCard compact>
        <SectionTitle>Статусы поездки</SectionTitle>
        <InlineLabel label="1" value="Подтверждено" accentColor="#38BDF8" />
        <InlineLabel label="2" value="Водитель выехал" />
        <InlineLabel label="3" value="Посадка" />
        <InlineLabel label="4" value="В пути" />
        <InlineLabel label="5" value="Завершено" />
      </ServiceCard>

      <PrimaryButton title="Вернуться в такси" onPress={() => navigation.replace('PassengerHome', {})} />
    </ServiceScreen>
  );
};

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: '#082F49',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 12,
  },
  pillText: {
    color: '#7DD3FC',
    fontWeight: '800',
  },
});
