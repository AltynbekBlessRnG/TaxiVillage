import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { Socket } from 'socket.io-client';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createFoodOrdersSocket } from '../../api/socket';
import { loadAuth } from '../../storage/authStorage';
import { InlineLabel, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';
import { showAlert } from '../../components/AppAlert';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'MerchantOrders'>;

type OrderAction = {
  status: string;
  label: string;
  kind: 'primary' | 'secondary';
  /** Asked before an action that can't be undone. */
  confirm?: { title: string; message: string; button: string };
};

const FIND_COURIER: OrderAction = {
  status: 'SEARCHING_DRIVER',
  label: 'Найти курьера в приложении',
  kind: 'primary',
};
const OWN_COURIER: OrderAction = {
  status: 'ON_DELIVERY',
  label: 'Отдать своему курьеру',
  kind: 'secondary',
  confirm: {
    title: 'Отдать своему курьеру?',
    message:
      'Заказ повезёт ваш курьер, курьеры приложения его больше не увидят. Плата за доставку остаётся вам. Отменить это нельзя.',
    button: 'Отдать',
  },
};

/**
 * What the merchant can do next. A ready order goes either to one of our
 * couriers or to the merchant's own; while we are still searching, the
 * merchant can give up waiting and send it with their own.
 */
function orderActions(order: any): OrderAction[] {
  switch (order.status) {
    case 'PLACED':
      return [{ status: 'ACCEPTED', label: 'Принять заказ', kind: 'primary' }];
    case 'ACCEPTED':
      return [{ status: 'PREPARING', label: 'Начать готовить', kind: 'primary' }];
    case 'PREPARING':
    case 'READY_FOR_PICKUP':
      return [FIND_COURIER, OWN_COURIER];
    case 'SEARCHING_DRIVER':
      return [OWN_COURIER];
    case 'ON_DELIVERY':
      return order.ownCourier
        ? [
            {
              status: 'DELIVERED',
              label: 'Заказ доставлен',
              kind: 'primary',
              confirm: {
                title: 'Заказ доставлен?',
                message: 'Отметьте, только когда клиент получил заказ.',
                button: 'Доставлен',
              },
            },
          ]
        : [];
    default:
      return [];
  }
}

const statusLabels: Record<string, string> = {
  PLACED: 'Новый заказ',
  ACCEPTED: 'Принят',
  PREPARING: 'Готовится',
  READY_FOR_PICKUP: 'Готов к выдаче',
  SEARCHING_DRIVER: 'Ищем водителя',
  DRIVER_ASSIGNED: 'Водитель назначен',
  AT_MERCHANT: 'Водитель в заведении',
  ON_DELIVERY: 'Передан курьеру приложения',
  DELIVERED: 'Доставлен',
  CANCELED: 'Отменен',
};

export const MerchantOrdersScreen: React.FC<Props> = ({ navigation, route }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

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

  const advanceStatus = async (orderId: string, nextStatus: string) => {
    // One request per order at a time, so a double tap can't send two.
    if (busyOrderId) {
      return;
    }
    setBusyOrderId(orderId);
    try {
      await apiClient.post(`/food-orders/${orderId}/status`, { status: nextStatus });
      await loadOrders();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось обновить статус';
      showAlert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setBusyOrderId(null);
    }
  };

  const runAction = (orderId: string, action: OrderAction) => {
    if (!action.confirm) {
      advanceStatus(orderId, action.status).catch(() => null);
      return;
    }
    showAlert(action.confirm.title, action.confirm.message, [
      { text: 'Назад', style: 'cancel' },
      {
        text: action.confirm.button,
        onPress: () => {
          advanceStatus(orderId, action.status).catch(() => null);
        },
      },
    ]);
  };

  const cancelOrder = (orderId: string) => {
    showAlert(
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
                showAlert(
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
        <ActivityIndicator size="large" color={colors.food} />
      </View>
    );
  }

  return (
    <ServiceScreen
      accentColor={colors.food}
      eyebrow="Заведение"
      title="Входящие заказы"
      subtitle="Принимайте заказы и обновляйте их статус."
      backLabel="К кабинету"
      onBack={() => navigation.goBack()}
    >
      <View style={styles.heroBlock}>
        <Text style={styles.heroTitle}>Работа с заказами</Text>
        <Text style={styles.heroText}>
          Примите заказ, приготовьте и отправьте: курьером из приложения или своим курьером.
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
            <Text style={styles.cardTitle}>
              {order.status === 'ON_DELIVERY' && order.ownCourier
                ? 'У вашего курьера'
                : statusLabels[order.status] || order.status}
            </Text>
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
          {order.status === 'SEARCHING_DRIVER' ? (
            <Text style={styles.hintText}>
              Ищем курьера в приложении. Если долго никто не берёт, отправьте своим курьером.
            </Text>
          ) : null}
          {orderActions(order).map((action) => (
            <TouchableOpacity
              key={action.status}
              style={[
                action.kind === 'primary' ? styles.actionButton : styles.secondaryActionButton,
                busyOrderId === order.id && styles.busyButton,
              ]}
              onPress={() => runAction(order.id, action)}
              disabled={busyOrderId === order.id}
              accessibilityRole="button"
              accessibilityState={{ disabled: busyOrderId === order.id }}
            >
              <Text
                style={
                  action.kind === 'primary' ? styles.actionButtonText : styles.secondaryActionButtonText
                }
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
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
    backgroundColor: colors.bg,
  },
  heroBlock: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    marginBottom: 8,
  },
  heroText: {
    color: colors.foodText,
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
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: colors.foodSurface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeActive: {
    backgroundColor: colors.successSurface,
  },
  statusBadgeText: {
    color: colors.foodTextSoft,
    fontSize: 12,
    fontWeight: '800',
  },
  actionButton: {
    backgroundColor: colors.food,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  actionButtonText: {
    color: colors.textInverse,
    fontWeight: '900',
    fontSize: 15,
  },
  secondaryActionButton: {
    borderWidth: 1,
    borderColor: colors.foodBorder,
    backgroundColor: colors.foodSurface,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryActionButtonText: {
    color: colors.foodTextSoft,
    fontWeight: '800',
    fontSize: 15,
  },
  busyButton: {
    opacity: 0.5,
  },
  hintText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: colors.dangerText,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  openedFromLinkText: {
    color: colors.successText,
    fontSize: 14,
    fontWeight: '800',
  },
});
