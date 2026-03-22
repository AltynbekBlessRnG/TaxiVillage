import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { InlineLabel, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'CourierProfile'>;

export const CourierProfileScreen: React.FC<Props> = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get('/couriers/profile')
      .then((response) => setProfile(response.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  return (
    <ServiceScreen
      accentColor="#F59E0B"
      eyebrow="Профиль"
      title="Профиль курьера"
      subtitle="Отдельная рабочая роль с собственным online-state, локацией и активными доставками."
    >
      <ServiceCard>
        <InlineLabel label="Имя" value={profile?.fullName || 'Без имени'} />
        <InlineLabel label="Телефон" value={profile?.user?.phone || '-'} />
        <InlineLabel label="Статус профиля" value={profile?.status || 'APPROVED'} accentColor="#F59E0B" />
        <InlineLabel label="На линии" value={profile?.isOnline ? 'Да' : 'Нет'} />
        <InlineLabel label="Рейтинг" value={String(profile?.rating ?? 5)} />
      </ServiceCard>
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
});
