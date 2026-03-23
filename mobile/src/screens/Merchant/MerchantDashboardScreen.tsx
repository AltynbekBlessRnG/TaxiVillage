import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { InlineLabel, PrimaryButton, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'MerchantDashboard'>;

export const MerchantDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(() => {
    apiClient
      .get('/merchants/profile/me')
      .then((response) => setProfile(response.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FB923C" />
      </View>
    );
  }

  return (
    <ServiceScreen
      accentColor="#FB923C"
      eyebrow="Merchant"
      title="Кабинет заведения"
      subtitle="Профиль merchant-а уже читает backend и становится источником данных для food-каталога."
    >
      <ServiceCard>
        <InlineLabel label="Название" value={profile?.name || 'Новое заведение'} />
        <InlineLabel label="Кухня" value={profile?.cuisine || 'Не указана'} />
        <InlineLabel label="Открыто" value={profile?.isOpen ? 'Да' : 'Нет'} accentColor="#FB923C" />
        <InlineLabel label="Меню" value={`${profile?.menuCategories?.length || 0} категорий`} />
      </ServiceCard>
      <PrimaryButton title="Открыть заказы" onPress={() => navigation.navigate('MerchantOrders')} />
      <PrimaryButton title="Редактор меню" onPress={() => navigation.navigate('MenuEditor')} accentColor="#F4F4F5" />
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
