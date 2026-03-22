import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import {
  ChipRow,
  InlineLabel,
  PrimaryButton,
  SectionTitle,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'CourierStatus'>;

const statusLabels: Record<string, string> = {
  SEARCHING_COURIER: 'Ищем курьера',
  TO_PICKUP: 'Курьер едет к точке забора',
  PICKED_UP: 'Посылка у курьера',
  DELIVERING: 'Курьер везет получателю',
  DELIVERED: 'Доставлено',
  CANCELED: 'Заказ отменен',
};

export const CourierStatusScreen: React.FC<Props> = ({ navigation, route }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrder = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const response = await apiClient.get(`/courier-orders/${route.params.orderId}`);
      setOrder(response.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [route.params.orderId]);

  useEffect(() => {
    loadOrder().catch(() => null);
  }, [loadOrder]);

  if (loading && !order) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  const statusLabel = statusLabels[order?.status] ?? 'Курьерский заказ';
  const price =
    order?.estimatedPrice != null
      ? `${Math.round(Number(order.estimatedPrice))} тг`
      : 'Уточняется';

  return (
    <ServiceScreen
      accentColor="#F59E0B"
      eyebrow="Курьер"
      title="Доставка в работе"
      subtitle="Первая рабочая вертикаль: статус читается с backend и больше не живет только на моках."
      backLabel="На главную"
      onBack={() => navigation.navigate('PassengerHome', {})}
    >
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadOrder(true).catch(() => null);
            }}
            tintColor="#F59E0B"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <ServiceCard>
          <SectionTitle>Текущий статус</SectionTitle>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{statusLabel}</Text>
          </View>
          <InlineLabel label="Откуда" value={order?.pickupAddress || 'Точка забора'} />
          <InlineLabel label="Куда" value={order?.dropoffAddress || 'Точка доставки'} />
          <InlineLabel label="Что везем" value={order?.itemDescription || 'Посылка'} accentColor="#F59E0B" />
          <InlineLabel label="Вес" value={order?.packageWeight || 'Не указан'} />
          <InlineLabel label="Цена" value={price} accentColor="#60A5FA" />
        </ServiceCard>

        <ServiceCard compact>
          <SectionTitle>Этапы заказа</SectionTitle>
          <ChipRow items={['Ищем курьера', 'Едет к забору', 'Посылка у курьера', 'Доставлено']} />
        </ServiceCard>

        <PrimaryButton title="Обновить статус" onPress={() => loadOrder().catch(() => null)} />
      </ScrollView>
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
    backgroundColor: '#3F2B05',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  statusPillText: {
    color: '#FCD34D',
    fontSize: 13,
    fontWeight: '800',
  },
});
