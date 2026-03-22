import React from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ServiceCard, ServiceScreen } from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityDriverProfile'>;

export const IntercityDriverProfileScreen: React.FC<Props> = () => (
  <ServiceScreen
    accentColor="#38BDF8"
    eyebrow="Профиль"
    title="Профиль межгорода"
    subtitle="Отдельные правила лицензии, междугородние направления и вместимость."
  >
    <ServiceCard>
      <Text style={{ color: '#F4F4F5', fontSize: 16, lineHeight: 24 }}>
        Это отдельная роль `DRIVER_INTERCITY`, подготовленная под дальнейший backend rollout.
      </Text>
    </ServiceCard>
  </ServiceScreen>
);
