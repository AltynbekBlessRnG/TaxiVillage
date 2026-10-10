import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { InlineLabel, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'FoodOrderHistory'>;

const statusLabels: Record<string, string> = {
  PLACED: 'Оформлен',
  ACCEPTED: 'Принят',
  PREPARING: 'Готовится',
  READY_FOR_PICKUP: 'Готов',
  SEARCHING_DRIVER: 'Ищем водителя',
  DRIVER_ASSIGNED: 'Водитель назначен',
  AT_MERCHANT: 'Водитель в заведении',
  ON_DELIVERY: 'В пути',
  DELIVERED: 'Доставлен',
  CANCELED: 'Отменён',
};

export const FoodOrderHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      apiClient
        .get('/food-orders/my')
        .then((response) => {
          if (active) setOrders(response.data || []);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ServiceScreen
      accentColor={colors.food}
      eyebrow="Еда"
      title="Мои заказы"
      subtitle="История заказов и текущие доставки."
      backLabel="Назад"
      onBack={() => navigation.goBack()}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.food} />
        </View>
      ) : null}
      {!loading && orders.length === 0 ? (
        <ServiceCard compact>
          <Text style={styles.empty}>У вас пока нет заказов еды.</Text>
        </ServiceCard>
      ) : null}
      {orders.map((order) => (
        <TouchableOpacity
          key={order.id}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate('FoodOrderStatus', { orderId: order.id })
          }
        >
          <ServiceCard compact>
            <View style={styles.header}>
              <Text style={styles.name}>{order.merchant?.name || 'Заведение'}</Text>
              <Text
                style={[
                  styles.status,
                  order.status === 'CANCELED' && styles.statusCanceled,
                ]}
              >
                {statusLabels[order.status] || order.status}
              </Text>
            </View>
            <InlineLabel
              label={new Date(order.createdAt).toLocaleDateString('ru-RU')}
              value={`${Math.round(Number(order.totalPrice || 0))} ₸`}
              accentColor={colors.foodText}
            />
            <Text style={styles.items}>
              {(order.items || [])
                .map((item: any) => `${item.qty}× ${item.name}`)
                .join(', ')}
            </Text>
          </ServiceCard>
        </TouchableOpacity>
      ))}
    </ServiceScreen>
  );
};

const styles = StyleSheet.create({
  loading: { paddingVertical: 30 },
  empty: { color: colors.textSecondary, fontSize: 15 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  name: { color: colors.text, fontWeight: '900', fontSize: 17, flex: 1 },
  status: { color: colors.successText, fontWeight: '800', fontSize: 12 },
  statusCanceled: { color: colors.dangerText },
  items: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
