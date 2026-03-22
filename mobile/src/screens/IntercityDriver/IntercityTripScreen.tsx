import React from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { PrimaryButton, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityTrip'>;

export const IntercityTripScreen: React.FC<Props> = ({ navigation }) => (
  <ServiceScreen
    accentColor="#38BDF8"
    eyebrow="Активная поездка"
    title="Межгородний рейс"
    subtitle="Компактная карта, крупный блок времени, остановки и посадка пассажиров."
    backLabel="К home межгорода"
    onBack={() => navigation.goBack()}
  >
    <ServiceCard>
      <Text style={{ color: '#F4F4F5', fontSize: 16, lineHeight: 24 }}>
        Здесь будет отдельный trip-screen межгорода без смешивания с taxi ride screen.
      </Text>
    </ServiceCard>
    <PrimaryButton title="Профиль водителя" onPress={() => navigation.navigate('IntercityDriverProfile')} />
  </ServiceScreen>
);
