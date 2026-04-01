import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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

const foodStages = [
  { key: 'PLACED', title: 'Заказ оформлен' },
  { key: 'ACCEPTED', title: 'Заведение приняло заказ' },
  { key: 'PREPARING', title: 'Готовится' },
  { key: 'READY_FOR_PICKUP', title: 'Готов к выдаче' },
  { key: 'ON_DELIVERY', title: 'Курьер в пути' },
  { key: 'DELIVERED', title: 'Доставлено' },
];

export const FoodOrderStatusScreen: React.FC<Props> = ({ navigation, route }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadOrder = useCallback(() => {
    apiClient
      .get(`/food-orders/${route.params.orderId}`)
      .then((response) => setOrder(response.data))
      .finally(() => setLoading(false));
  }, [route.params.orderId]);

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
      subtitle="Следи за кухней, доставкой и итогом заказа без лишних переходов."
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
          <Text style={styles.statusText}>{statusLabels[order?.status] || 'Food order'}</Text>
        </View>
        <InlineLabel label="Заведение" value={order?.merchant?.name || '-'} />
        <InlineLabel label="Адрес доставки" value={order?.deliveryAddress || '-'} />
        <InlineLabel label="Итого" value={`${Math.round(Number(order?.totalPrice || 0))} тг`} accentColor="#60A5FA" />
      </ServiceCard>

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

        <PrimaryButton title="Вернуться в такси" onPress={() => navigation.navigate('PassengerHome', {})} />
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
});
