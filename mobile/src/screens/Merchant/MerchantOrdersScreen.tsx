import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { InlineLabel, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'MerchantOrders'>;

const nextStatusMap: Record<string, string | null> = {
  PLACED: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'READY_FOR_PICKUP',
  READY_FOR_PICKUP: 'ON_DELIVERY',
  ON_DELIVERY: 'DELIVERED',
  DELIVERED: null,
  CANCELED: null,
};

const statusLabels: Record<string, string> = {
  PLACED: 'Новый заказ',
  ACCEPTED: 'Принят',
  PREPARING: 'Готовится',
  READY_FOR_PICKUP: 'Готов к выдаче',
  ON_DELIVERY: 'Передан в доставку',
  DELIVERED: 'Доставлен',
  CANCELED: 'Отменен',
};

export const MerchantOrdersScreen: React.FC<Props> = ({ navigation }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(() =>
    apiClient
      .get('/merchants/orders/me')
      .then((response) => setOrders(response.data))
      .finally(() => setLoading(false)), []);

  useEffect(() => {
    loadOrders().catch(() => null);
  }, [loadOrders]);

  useFocusEffect(
    useCallback(() => {
      loadOrders().catch(() => null);
      const intervalId = setInterval(() => {
        loadOrders().catch(() => null);
      }, 5000);
      return () => clearInterval(intervalId);
    }, [loadOrders]),
  );

  const advanceStatus = async (orderId: string, currentStatus: string) => {
    const nextStatus = nextStatusMap[currentStatus];
    if (!nextStatus) {
      return;
    }
    try {
      await apiClient.post(`/food-orders/${orderId}/status`, { status: nextStatus });
      await loadOrders();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось обновить статус';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    }
  };

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
      eyebrow="Kitchen"
      title="Входящие food orders"
      subtitle="Merchant уже может принимать заказ и двигать его по kitchen-статусам."
      backLabel="К кабинету"
      onBack={() => navigation.goBack()}
    >
      {orders.length === 0 ? (
        <ServiceCard compact>
          <Text style={styles.emptyText}>Пока нет входящих food orders.</Text>
        </ServiceCard>
      ) : null}

      {orders.map((order) => (
        <ServiceCard key={order.id}>
          <Text style={styles.cardTitle}>{statusLabels[order.status] || order.status}</Text>
          <InlineLabel label="Клиент" value={order.passenger?.fullName || order.passenger?.user?.phone || 'Пассажир'} />
          <InlineLabel label="Адрес" value={order.deliveryAddress} />
          <InlineLabel label="Сумма" value={`${Math.round(Number(order.totalPrice || 0))} тг`} accentColor="#FB923C" />
          {order.items.map((item: any) => (
            <InlineLabel
              key={item.id}
              label={`${item.qty} x ${item.name}`}
              value={`${Math.round(Number(item.price || 0))} тг`}
            />
          ))}
          {nextStatusMap[order.status] ? (
            <TouchableOpacity style={styles.actionButton} onPress={() => advanceStatus(order.id, order.status)}>
              <Text style={styles.actionButtonText}>Следующий этап</Text>
            </TouchableOpacity>
          ) : null}
        </ServiceCard>
      ))}
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
  cardTitle: {
    color: '#F4F4F5',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: '#FB923C',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  actionButtonText: {
    color: '#09090B',
    fontWeight: '900',
    fontSize: 15,
  },
  emptyText: {
    color: '#A1A1AA',
    fontSize: 15,
    lineHeight: 22,
  },
});
