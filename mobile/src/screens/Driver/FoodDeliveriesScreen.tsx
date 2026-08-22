import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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

type Props = NativeStackScreenProps<RootStackParamList, 'FoodDeliveries'>;

const nextStatus: Record<string, { status: string; label: string } | undefined> = {
  DRIVER_ASSIGNED: { status: 'AT_MERCHANT', label: 'Я в заведении' },
  AT_MERCHANT: { status: 'ON_DELIVERY', label: 'Заказ забран' },
  ON_DELIVERY: { status: 'DELIVERED', label: 'Заказ доставлен' },
};

export const FoodDeliveriesScreen: React.FC<Props> = ({ navigation }) => {
  const [available, setAvailable] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [availableResponse, currentResponse] = await Promise.all([
        apiClient.get('/driver/food-deliveries/available'),
        apiClient.get('/driver/food-deliveries/current'),
      ]);
      setAvailable(availableResponse.data || []);
      setCurrent(currentResponse.data || null);
    } catch (error: any) {
      const message = error?.response?.data?.message;
      if (message) {
        showAlert('Доставка недоступна', Array.isArray(message) ? message.join(', ') : message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => null);
      const timer = setInterval(() => load().catch(() => null), 15_000);
      return () => clearInterval(timer);
    }, [load]),
  );

  useEffect(() => {
    let socket: Socket | null = null;
    let active = true;
    loadAuth()
      .then((auth) => {
        if (!auth?.accessToken || !active) return;
        socket = createFoodOrdersSocket(auth.accessToken);
        socket.on('food-delivery:available', () => load().catch(() => null));
        socket.on('food-order:updated', () => load().catch(() => null));
      })
      .catch(() => null);
    return () => {
      active = false;
      socket?.disconnect();
    };
  }, [load]);

  const claim = async (orderId: string) => {
    setActionLoading(true);
    try {
      await apiClient.post(`/driver/food-deliveries/${orderId}/claim`);
      await load();
    } catch (error: any) {
      const message =
        error?.response?.data?.message || 'Доставку уже принял другой водитель.';
      showAlert('Не удалось принять', Array.isArray(message) ? message.join(', ') : message);
      await load();
    } finally {
      setActionLoading(false);
    }
  };

  const advance = async () => {
    const next = nextStatus[current?.status];
    if (!next) return;
    setActionLoading(true);
    try {
      await apiClient.post(`/driver/food-deliveries/${current.id}/status`, {
        status: next.status,
      });
      await load();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось обновить статус.';
      showAlert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setActionLoading(false);
    }
  };

  const openRoute = (order: any, toCustomer: boolean) => {
    const lat = toCustomer ? order.deliveryLat : order.merchant?.lat;
    const lng = toCustomer ? order.deliveryLng : order.merchant?.lng;
    const query =
      lat != null && lng != null
        ? `${lat},${lng}`
        : encodeURIComponent(
            toCustomer ? order.deliveryAddress : order.merchant?.address || order.merchant?.name,
          );
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${query}`).catch(
      () => null,
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#FB923C" size="large" />
      </View>
    );
  }

  return (
    <ServiceScreen
      accentColor="#FB923C"
      eyebrow="Водитель"
      title="Доставка еды"
      subtitle="Вся стоимость доставки указана до принятия заказа."
      backLabel="К карте"
      onBack={() => navigation.goBack()}
    >
      {current ? (
        <ServiceCard>
          <SectionTitle>Текущая доставка</SectionTitle>
          <InlineLabel label="Заведение" value={current.merchant?.name || '-'} />
          <InlineLabel label="Забрать" value={current.merchant?.address || '-'} />
          <InlineLabel label="Доставить" value={current.deliveryAddress} />
          <InlineLabel
            label="Получите за доставку"
            value={`${Math.round(Number(current.driverPayout || 0))} ₸`}
            accentColor="#86EFAC"
          />
          <InlineLabel
            label="Оплата заказа"
            value={
              current.paymentMethod === 'KASPI_TRANSFER'
                ? 'Перевод Kaspi'
                : 'Наличными'
            }
          />
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.routeButton}
              onPress={() =>
                openRoute(current, current.status === 'ON_DELIVERY')
              }
            >
              <Text style={styles.routeButtonText}>Открыть маршрут</Text>
            </TouchableOpacity>
            {current.passengerPhoneSnapshot ? (
              <TouchableOpacity
                style={styles.routeButton}
                onPress={() =>
                  Linking.openURL(`tel:${current.passengerPhoneSnapshot}`).catch(
                    () => null,
                  )
                }
              >
                <Text style={styles.routeButtonText}>Позвонить клиенту</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {nextStatus[current.status] ? (
            <PrimaryButton
              title={
                actionLoading ? 'Обновляем…' : nextStatus[current.status]!.label
              }
              onPress={advance}
              disabled={actionLoading}
              accentColor="#FB923C"
            />
          ) : null}
        </ServiceCard>
      ) : null}

      {!current ? <SectionTitle>Доступные заказы</SectionTitle> : null}
      {!current && available.length === 0 ? (
        <ServiceCard compact>
          <Text style={styles.empty}>Сейчас доступных доставок нет.</Text>
        </ServiceCard>
      ) : null}
      {!current
        ? available.map((order) => (
            <ServiceCard key={order.id}>
              <Text style={styles.merchantName}>{order.merchant?.name}</Text>
              <InlineLabel
                label="Забрать"
                value={order.merchant?.address || 'Адрес уточняется'}
              />
              <InlineLabel label="Доставить" value={order.deliveryAddress} />
              {order.distanceToMerchantKm != null ? (
                <InlineLabel
                  label="До заведения"
                  value={`${Number(order.distanceToMerchantKm).toFixed(1)} км`}
                />
              ) : null}
              <InlineLabel
                label="Доход"
                value={`${Math.round(Number(order.driverPayout || 0))} ₸`}
                accentColor="#86EFAC"
              />
              <PrimaryButton
                title={actionLoading ? 'Принимаем…' : 'Принять доставку'}
                onPress={() => claim(order.id)}
                disabled={actionLoading}
                accentColor="#FB923C"
              />
            </ServiceCard>
          ))
        : null}
    </ServiceScreen>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090B',
  },
  empty: { color: '#A1A1AA', fontSize: 15 },
  merchantName: {
    color: '#F4F4F5',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 12,
  },
  actions: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  routeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
  },
  routeButtonText: { color: '#FDBA74', fontWeight: '800', fontSize: 12 },
});
