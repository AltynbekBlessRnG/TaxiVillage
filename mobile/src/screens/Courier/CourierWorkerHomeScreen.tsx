import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import {
  InlineLabel,
  PrimaryButton,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'CourierWorkerHome'>;

export const CourierWorkerHomeScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, currentRes, availableRes] = await Promise.all([
        apiClient.get('/couriers/profile'),
        apiClient.get('/couriers/current-order').catch(() => ({ data: null })),
        apiClient.get('/courier-orders/available').catch(() => ({ data: [] })),
      ]);

      setProfile(profileRes.data);
      setCurrentOrder(currentRes.data);
      setAvailableOrders(Array.isArray(availableRes.data) ? availableRes.data : []);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось загрузить данные курьера';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData().catch(() => null);
  }, [loadData]);

  const toggleOnline = async () => {
    if (!profile) {
      return;
    }
    setStatusLoading(true);
    try {
      const response = await apiClient.post('/couriers/status', { isOnline: !profile.isOnline });
      setProfile(response.data);
      await loadData();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось изменить статус';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setStatusLoading(false);
    }
  };

  const acceptOrder = async (orderId: string) => {
    try {
      await apiClient.post(`/courier-orders/${orderId}/accept`);
      navigation.navigate('CourierOrder', { orderId });
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось принять заказ';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    }
  };

  if (loading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  return (
    <ServiceScreen
      accentColor="#F59E0B"
      eyebrow="Курьер mode"
      title="Рабочий режим курьера"
      subtitle="Отдельный home под online/offline, активную доставку и доступные офферы."
    >
      <ServiceCard>
        <InlineLabel label="Курьер" value={profile?.fullName || profile?.user?.phone || 'Courier'} />
        <InlineLabel label="Статус" value={profile?.isOnline ? 'На линии' : 'Не на линии'} accentColor="#F59E0B" />
        <PrimaryButton
          title={statusLoading ? 'Обновляем...' : profile?.isOnline ? 'Уйти с линии' : 'Выйти на линию'}
          onPress={toggleOnline}
          accentColor={profile?.isOnline ? '#FCD34D' : '#F59E0B'}
        />
      </ServiceCard>

      {currentOrder ? (
        <ServiceCard>
          <Text style={styles.cardTitle}>Активная доставка</Text>
          <InlineLabel label="Забрать" value={currentOrder.pickupAddress} />
          <InlineLabel label="Доставить" value={currentOrder.dropoffAddress} />
          <InlineLabel label="Посылка" value={currentOrder.itemDescription} accentColor="#F59E0B" />
          <PrimaryButton title="Открыть заказ" onPress={() => navigation.navigate('CourierOrder', { orderId: currentOrder.id })} />
        </ServiceCard>
      ) : null}

      {!currentOrder && availableOrders.length > 0 ? (
        availableOrders.slice(0, 3).map((order) => (
          <ServiceCard key={order.id} compact>
            <Text style={styles.cardTitle}>Новый оффер</Text>
            <InlineLabel label="Забрать" value={order.pickupAddress} />
            <InlineLabel label="Куда" value={order.dropoffAddress} />
            <InlineLabel label="Цена" value={`${Math.round(Number(order.estimatedPrice || 0))} тг`} accentColor="#60A5FA" />
            <InlineLabel
              label="Дистанция"
              value={order.distanceKm != null ? `${order.distanceKm.toFixed(1)} км` : 'Неизвестно'}
            />
            <TouchableOpacity style={styles.acceptButton} onPress={() => acceptOrder(order.id)}>
              <Text style={styles.acceptButtonText}>Принять заказ</Text>
            </TouchableOpacity>
          </ServiceCard>
        ))
      ) : null}

      {!currentOrder && availableOrders.length === 0 ? (
        <ServiceCard compact>
          <Text style={styles.emptyText}>Пока нет доступных курьерских заказов рядом.</Text>
        </ServiceCard>
      ) : null}

      <PrimaryButton title="Профиль курьера" onPress={() => navigation.navigate('CourierProfile')} accentColor="#F4F4F5" />
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
  acceptButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  acceptButtonText: {
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
