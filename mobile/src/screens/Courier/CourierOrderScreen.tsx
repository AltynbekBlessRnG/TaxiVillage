import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
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

type Props = NativeStackScreenProps<RootStackParamList, 'CourierOrder'>;

const statusLabels: Record<string, string> = {
  SEARCHING_COURIER: 'Ожидает курьера',
  TO_PICKUP: 'Еду к точке забора',
  PICKED_UP: 'Посылка у меня',
  DELIVERING: 'Везу получателю',
  DELIVERED: 'Доставлено',
  CANCELED: 'Отменено',
};

export const CourierOrderScreen: React.FC<Props> = ({ navigation, route }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const orderId = route.params?.orderId;

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      let resolvedOrderId = orderId;
      if (!resolvedOrderId) {
        const current = await apiClient.get('/couriers/current-order');
        resolvedOrderId = current.data?.id;
      }

      if (!resolvedOrderId) {
        setOrder(null);
        return;
      }

      const response = await apiClient.get(`/courier-orders/${resolvedOrderId}`);
      setOrder(response.data);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось загрузить заказ';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder().catch(() => null);
  }, [loadOrder]);

  const updateStatus = async (status: string) => {
    if (!order?.id) {
      return;
    }
    try {
      await apiClient.post(`/courier-orders/${order.id}/status`, { status });
      await loadOrder();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось обновить статус';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    }
  };

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
      eyebrow="Активная доставка"
      title="Курьерский заказ"
      subtitle="Первый рабочий worker-side экран для новой вертикали: статусы уже живут в backend."
      backLabel="К home курьера"
      onBack={() => navigation.goBack()}
    >
      <ServiceCard>
        <SectionTitle>Маршрут доставки</SectionTitle>
        <InlineLabel label="Статус" value={statusLabels[order?.status] || 'Нет активного заказа'} accentColor="#F59E0B" />
        <InlineLabel label="Забрать" value={order?.pickupAddress || 'Нет активного заказа'} />
        <InlineLabel label="Доставить" value={order?.dropoffAddress || '-'} />
        <InlineLabel label="Посылка" value={order?.itemDescription || '-'} />
        <InlineLabel label="Цена" value={order?.estimatedPrice ? `${Math.round(Number(order.estimatedPrice))} тг` : '-'} accentColor="#60A5FA" />
      </ServiceCard>

      {order?.status === 'TO_PICKUP' ? (
        <PrimaryButton title="Забрал посылку" onPress={() => updateStatus('PICKED_UP')} accentColor="#F59E0B" />
      ) : null}

      {order?.status === 'PICKED_UP' ? (
        <PrimaryButton title="Везу получателю" onPress={() => updateStatus('DELIVERING')} accentColor="#F59E0B" />
      ) : null}

      {order?.status === 'DELIVERING' ? (
        <PrimaryButton title="Доставлено" onPress={() => updateStatus('DELIVERED')} accentColor="#F59E0B" />
      ) : null}
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
