import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import MapView, { Marker } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import type { Socket } from 'socket.io-client';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createFoodOrdersSocket } from '../../api/socket';
import { loadAuth } from '../../storage/authStorage';
import {
  InlineLabel,
  PrimaryButton,
  SectionTitle,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';
import { showAlert } from '../../components/AppAlert';

type Props = NativeStackScreenProps<RootStackParamList, 'FoodOrderStatus'>;

const statusLabels: Record<string, string> = {
  PLACED: 'Заказ оформлен',
  ACCEPTED: 'Заведение приняло заказ',
  PREPARING: 'Готовится',
  READY_FOR_PICKUP: 'Готов к выдаче',
  SEARCHING_DRIVER: 'Ищем водителя',
  DRIVER_ASSIGNED: 'Водитель едет в заведение',
  AT_MERCHANT: 'Водитель забирает заказ',
  ON_DELIVERY: 'Курьер в пути',
  DELIVERED: 'Доставлено',
  CANCELED: 'Отменено',
};

const foodStages = [
  { key: 'PLACED', title: 'Заказ оформлен' },
  { key: 'ACCEPTED', title: 'Заведение приняло заказ' },
  { key: 'PREPARING', title: 'Готовится' },
  { key: 'SEARCHING_DRIVER', title: 'Ищем водителя' },
  { key: 'DRIVER_ASSIGNED', title: 'Водитель назначен' },
  { key: 'AT_MERCHANT', title: 'Водитель в заведении' },
  { key: 'ON_DELIVERY', title: 'Курьер в пути' },
  { key: 'DELIVERED', title: 'Доставлено' },
];

export const FoodOrderStatusScreen: React.FC<Props> = ({ navigation, route }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadOrder = useCallback(() => {
    apiClient
      .get(`/food-orders/${route.params.orderId}`)
      .then((response) => setOrder(response.data))
      .finally(() => setLoading(false));
  }, [route.params.orderId]);

  const cancelOrder = () => {
    showAlert('Отменить заказ?', 'Отмена доступна до принятия заведением.', [
      { text: 'Оставить', style: 'cancel' },
      {
        text: 'Отменить',
        style: 'destructive',
        onPress: () => {
          setActionLoading(true);
          apiClient
            .post(`/food-orders/${order.id}/cancel`, {
              reason: 'Отменено клиентом',
            })
            .then((response) => setOrder(response.data))
            .catch((error: any) =>
              showAlert(
                'Не удалось отменить',
                error?.response?.data?.message || 'Попробуйте ещё раз.',
              ),
            )
            .finally(() => setActionLoading(false));
        },
      },
    ]);
  };

  const repeatOrder = async () => {
    setActionLoading(true);
    try {
      const key = `repeat-${order.id}-${Date.now()}`;
      const response = await apiClient.post(
        `/food-orders/${order.id}/repeat`,
        {},
        { headers: { 'Idempotency-Key': key } },
      );
      navigation.replace('FoodOrderStatus', { orderId: response.data.id });
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось повторить заказ';
      showAlert('Заказ не создан', Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
      return undefined;
    }, [loadOrder]),
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

      socket.on('connect', () => {
        socket?.emit('join:food-order', route.params.orderId);
      });

      socket.on('food-order:updated', (nextOrder: any) => {
        if (!isMounted || nextOrder?.id !== route.params.orderId) {
          return;
        }
        setOrder(nextOrder);
        setLoading(false);
      });
    };

    setupSocket().catch(() => null);

    return () => {
      isMounted = false;
      socket?.disconnect();
    };
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
      subtitle="Здесь отображаются приготовление и доставка заказа."
      backLabel="На главную"
      onBack={() => navigation.navigate('PassengerHome', {})}
    >
      <View style={styles.heroBlock}>
        <Text style={styles.heroTitle}>{order?.merchant?.name || 'Ваш заказ принят'}</Text>
        <Text style={styles.heroText}>{statusLabels[order?.status] || 'Статус обновляется'}</Text>
      </View>

      <ServiceCard>
        <SectionTitle>Статус кухни</SectionTitle>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{statusLabels[order?.status] || 'Заказ'}</Text>
        </View>
        <InlineLabel label="Заведение" value={order?.merchant?.name || '-'} />
        <InlineLabel label="Адрес доставки" value={order?.deliveryAddress || '-'} />
        <InlineLabel label="Блюда" value={`${Math.round(Number(order?.subtotal || 0))} ₸`} />
        <InlineLabel label="Доставка" value={`${Math.round(Number(order?.deliveryFee || 0))} ₸`} />
        {Number(order?.discountAmount || 0) > 0 ? (
          <InlineLabel
            label="Скидка"
            value={`−${Math.round(Number(order.discountAmount))} ₸`}
            accentColor="#86EFAC"
          />
        ) : null}
        <InlineLabel label="Итого" value={`${Math.round(Number(order?.totalPrice || 0))} ₸`} accentColor="#60A5FA" />
        <InlineLabel
          label="Оплата"
          value={order?.paymentMethod === 'KASPI_TRANSFER' ? 'Перевод Kaspi' : 'Наличными'}
        />
        {order?.cancellationReason ? (
          <InlineLabel
            label="Причина отмены"
            value={order.cancellationReason}
            accentColor="#FCA5A5"
          />
        ) : null}
      </ServiceCard>

      {order?.driver ? (
        <ServiceCard compact>
          <SectionTitle>Водитель</SectionTitle>
          <InlineLabel
            label="Имя"
            value={order.driver.fullName || order.driver.user?.phone || 'Водитель'}
          />
          <InlineLabel
            label="Автомобиль"
            value={
              order.driver.car
                ? `${order.driver.car.make} ${order.driver.car.model}, ${order.driver.car.plateNumber}`
                : 'Автомобиль не указан'
            }
          />
          <InlineLabel
            label="Телефон"
            value={order.driver.user?.phone || 'Не указан'}
          />
          {order.driver.lat != null && order.driver.lng != null ? (
            <MapView
              style={styles.driverMap}
              initialRegion={{
                latitude: order.driver.lat,
                longitude: order.driver.lng,
                latitudeDelta: 0.025,
                longitudeDelta: 0.025,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker
                coordinate={{
                  latitude: order.driver.lat,
                  longitude: order.driver.lng,
                }}
                title="Водитель"
                pinColor="#FB923C"
              />
              {order.deliveryLat != null && order.deliveryLng != null ? (
                <Marker
                  coordinate={{
                    latitude: order.deliveryLat,
                    longitude: order.deliveryLng,
                  }}
                  title="Адрес доставки"
                  pinColor="#3B82F6"
                />
              ) : null}
            </MapView>
          ) : null}
        </ServiceCard>
      ) : null}

      <ServiceCard compact>
        <SectionTitle>Этапы</SectionTitle>
        <View style={styles.timeline}>
          {foodStages.map((stage, index) => {
            const currentIndex = foodStages.findIndex((item) => item.key === order?.status);
            const isCompleted = currentIndex >= index || order?.status === 'DELIVERED';
            return (
              <View key={stage.key} style={styles.timelineRow}>
                <View style={[styles.timelineDot, isCompleted && styles.timelineDotActive]} />
                <Text style={[styles.timelineText, isCompleted && styles.timelineTextActive]}>{stage.title}</Text>
              </View>
            );
          })}
        </View>
      </ServiceCard>

      {order?.status === 'PLACED' ? (
        <PrimaryButton
          title={actionLoading ? 'Отменяем…' : 'Отменить заказ'}
          onPress={cancelOrder}
          accentColor="#FCA5A5"
          disabled={actionLoading}
        />
      ) : null}
      {['DELIVERED', 'CANCELED'].includes(order?.status) ? (
        <PrimaryButton
          title={actionLoading ? 'Создаём…' : 'Повторить заказ'}
          onPress={repeatOrder}
          disabled={actionLoading}
        />
      ) : null}
      <PrimaryButton
        title="Мои заказы"
        onPress={() => navigation.navigate('FoodOrderHistory')}
        accentColor="#FDBA74"
      />
      <PrimaryButton title="На главную" onPress={() => navigation.navigate('PassengerHome', {})} />
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
    fontWeight: '700',
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
  timeline: {
    gap: 10,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#3F3F46',
    marginRight: 12,
  },
  timelineDotActive: {
    backgroundColor: '#FB923C',
  },
  timelineText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '600',
  },
  timelineTextActive: {
    color: '#F4F4F5',
  },
  driverMap: {
    height: 170,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 12,
  },
});
