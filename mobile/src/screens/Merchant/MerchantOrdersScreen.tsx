import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { Socket } from 'socket.io-client';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createFoodOrdersSocket } from '../../api/socket';
import { loadAuth } from '../../storage/authStorage';
import { InlineLabel, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'MerchantOrders'>;

const nextStatusMap: Record<string, string | null> = {
  PLACED: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'SEARCHING_DRIVER',
  READY_FOR_PICKUP: 'SEARCHING_DRIVER',
  SEARCHING_DRIVER: null,
  DRIVER_ASSIGNED: null,
  AT_MERCHANT: null,
  ON_DELIVERY: null,
  DELIVERED: null,
  CANCELED: null,
};

const statusLabels: Record<string, string> = {
  PLACED: 'Новый заказ',
  ACCEPTED: 'Принят',
  PREPARING: 'Готовится',
  READY_FOR_PICKUP: 'Готов к выдаче',
  SEARCHING_DRIVER: 'Ищем водителя',
  DRIVER_ASSIGNED: 'Водитель назначен',
  AT_MERCHANT: 'Водитель в заведении',
  ON_DELIVERY: 'Передан водителю',
  DELIVERED: 'Доставлен',
  CANCELED: 'Отменен',
};

export const MerchantOrdersScreen: React.FC<Props> = ({ navigation, route }) => {
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
      return undefined;
    }, [loadOrders]),
  );

  useEffect(() => {
    let isMounted = true;
    let socket: Socket | null = null;

    const setupSocket = async () => {
      const auth = await loadAuth();
      if (!auth?.accessToken || !isMounted) {
        return;
      }

      socket = createFoodOrdersSocket(auth.accessToken);

      const reloadOrders = () => {
        loadOrders().catch(() => null);
      };

      socket.on('food-order:created', reloadOrders);
      socket.on('food-order:updated', reloadOrders);
    };

    setupSocket().catch(() => null);

    return () => {
      isMounted = false;
      socket?.disconnect();
    };
  }, [loadOrders]);

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

  const cancelOrder = (orderId: string) => {
    Alert.alert(
      'Отменить заказ?',
      'Клиент сразу получит уведомление. Используйте отмену, если блюдо недоступно.',
      [
        { text: 'Назад', style: 'cancel' },
        {
          text: 'Блюдо недоступно',
          style: 'destructive',
          onPress: () => {
            apiClient
              .post(`/food-orders/${orderId}/cancel`, {
                reason: 'Одно или несколько блюд недоступны',
              })
              .then(loadOrders)
              .catch((error: any) => {
                const message =
                  error?.response?.data?.message || 'Не удалось отменить заказ';
                Alert.alert(
                  'Ошибка',
                  Array.isArray(message) ? message.join(', ') : message,
                );
              });
          },
        },
      ],
    );
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
      eyebrow="Заведение"
      title="Входящие заказы"
      subtitle="Принимайте заказы и обновляйте их статус."
      backLabel="К кабинету"
      onBack={() => navigation.goBack()}
    >
      <View style={styles.heroBlock}>
        <Text style={styles.heroTitle}>Кухня в работе</Text>
        <Text style={styles.heroText}>
          Сначала принимай новые заказы, затем двигай их по этапам до передачи в доставку.
        </Text>
      </View>

      {orders.length === 0 ? (
        <ServiceCard compact>
          <Text style={styles.emptyText}>Пока нет входящих заказов.</Text>
        </ServiceCard>
      ) : null}

      {route.params?.orderId ? (
        <ServiceCard compact>
          <Text style={styles.openedFromLinkText}>
            {orders.some((order) => order.id === route.params?.orderId)
              ? 'Открыт новый заказ'
              : 'Заказ по ссылке еще не появился в списке'}
          </Text>
        </ServiceCard>
      ) : null}

      {orders.map((order) => (
        <ServiceCard key={order.id}>
          <View style={styles.statusRow}>
            <Text style={styles.cardTitle}>{statusLabels[order.status] || order.status}</Text>
            <View style={[styles.statusBadge, route.params?.orderId === order.id && styles.statusBadgeActive]}>
              <Text style={styles.statusBadgeText}>{Math.round(Number(order.totalPrice || 0))} тг</Text>
            </View>
          </View>
          <InlineLabel label="Клиент" value={order.passenger?.fullName || order.passenger?.user?.phone || 'Пассажир'} />
          <InlineLabel label="Адрес" value={order.deliveryAddress} />
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
          {['PLACED', 'ACCEPTED', 'PREPARING', 'SEARCHING_DRIVER'].includes(
            order.status,
          ) ? (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => cancelOrder(order.id)}
            >
              <Text style={styles.cancelButtonText}>Отменить заказ</Text>
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
  heroBlock: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  heroTitle: {
    color: '#F4F4F5',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    marginBottom: 8,
  },
  heroText: {
    color: '#FDBA74',
    fontSize: 15,
    lineHeight: 22,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  cardTitle: {
    color: '#F4F4F5',
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: '#3F1F0F',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeActive: {
    backgroundColor: '#143124',
  },
  statusBadgeText: {
    color: '#FED7AA',
    fontSize: 12,
    fontWeight: '800',
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
  cancelButton: {
    borderWidth: 1,
    borderColor: '#7F1D1D',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#FCA5A5',
    fontWeight: '800',
  },
  emptyText: {
    color: '#A1A1AA',
    fontSize: 15,
    lineHeight: 22,
  },
  openedFromLinkText: {
    color: '#86EFAC',
    fontSize: 14,
    fontWeight: '800',
  },
});
