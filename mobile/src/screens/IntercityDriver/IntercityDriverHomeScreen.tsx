import React from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { PrimaryButton, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityDriverHome'>;

export const IntercityDriverHomeScreen: React.FC<Props> = ({ navigation }) => (
  <ServiceScreen
    accentColor="#38BDF8"
    eyebrow="Intercity Driver"
    title="Рабочий режим межгорода"
    subtitle="Отдельный home для междугородних заявок и подтвержденных поездок."
  >
    <ServiceCard>
      <Text style={{ color: '#F4F4F5', fontSize: 16, lineHeight: 24 }}>
        Межгород живет отдельно от городского такси: другая логика бронирования, выездов и багажа.
      </Text>
    </ServiceCard>
    <PrimaryButton title="Открыть поездку" onPress={() => navigation.navigate('IntercityTrip')} />
  </ServiceScreen>
);
