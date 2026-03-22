import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import {
  InlineLabel,
  PrimaryButton,
  SectionTitle,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'FoodOrderStatus'>;

const statusLabels: Record<string, string> = {
  PLACED: 'Заказ оформлен',
  ACCEPTED: 'Заведение приняло заказ',
  PREPARING: 'Готовится',
  READY_FOR_PICKUP: 'Готов к выдаче',
  ON_DELIVERY: 'Курьер в пути',
  DELIVERED: 'Доставлено',
  CANCELED: 'Отменено',
};

export const FoodOrderStatusScreen: React.FC<Props> = ({ navigation, route }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get(`/food-orders/${route.params.orderId}`)
      .then((response) => setOrder(response.data))
      .finally(() => setLoading(false));
  }, [route.params.orderId]);

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
      eyebrow="Еда"
      title="Заказ оформлен"
      subtitle="Экран статуса уже читает реальный `FoodOrder` и статус кухни из backend."
      backLabel="На главную"
      onBack={() => navigation.replace('PassengerHome', {})}
    >
      <ServiceCard>
        <SectionTitle>Статус кухни</SectionTitle>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{statusLabels[order?.status] || 'Food order'}</Text>
        </View>
        <InlineLabel label="Заведение" value={order?.merchant?.name || '-'} />
        <InlineLabel label="Адрес доставки" value={order?.deliveryAddress || '-'} />
        <InlineLabel label="Итого" value={`${Math.round(Number(order?.totalPrice || 0))} тг`} accentColor="#60A5FA" />
      </ServiceCard>

      <ServiceCard compact>
        <SectionTitle>Этапы</SectionTitle>
        <InlineLabel label="1" value="Заказ принят заведением" accentColor="#FB923C" />
        <InlineLabel label="2" value="Готовится" />
        <InlineLabel label="3" value="Готов к выдаче" />
        <InlineLabel label="4" value="Курьер в пути" />
        <InlineLabel label="5" value="Доставлено" />
      </ServiceCard>

      <PrimaryButton title="Вернуться в такси" onPress={() => navigation.replace('PassengerHome', {})} />
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
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#3F1F0F',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 14,
  },
  statusText: {
    color: '#FED7AA',
    fontWeight: '800',
  },
});
