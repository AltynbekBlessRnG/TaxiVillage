import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import {
  InlineLabel,
  PrimaryButton,
  SectionTitle,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityTripStatus'>;

const statusLabels: Record<string, string> = {
  CONFIRMED: 'Забронировано',
  BOARDING: 'Посадка',
  IN_PROGRESS: 'В пути',
  COMPLETED: 'Завершено',
  CANCELED: 'Отменено',
};

export const IntercityTripStatusScreen: React.FC<Props> = ({ navigation, route }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadOrder = useCallback(() => {
    apiClient
      .get(`/intercity-bookings/${route.params.bookingId}`)
      .then((response) => setOrder(response.data))
      .finally(() => setLoading(false));
  }, [route.params.bookingId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
      const intervalId = setInterval(loadOrder, 5000);
      return () => clearInterval(intervalId);
    }, [loadOrder]),
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  return (
    <ServiceScreen
      accentColor="#38BDF8"
      eyebrow="Межгород"
      title="Статус бронирования"
      subtitle="Пассажир видит актуальный статус своей брони и самого рейса."
      backLabel="На главную"
      onBack={() => navigation.navigate('PassengerHome', {})}
    >
      <ServiceCard>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{statusLabels[order?.status] || 'Межгород'}</Text>
        </View>
        <InlineLabel label="Маршрут" value={`${order?.trip?.fromCity || '-'} -> ${order?.trip?.toCity || '-'}`} />
        <InlineLabel label="Водитель" value={order?.trip?.driver?.fullName || order?.trip?.driver?.user?.phone || 'Водитель'} />
        <InlineLabel label="Выезд" value={new Date(order?.trip?.departureAt || Date.now()).toLocaleString()} accentColor="#38BDF8" />
        <InlineLabel label="Мест" value={String(order?.seatsBooked || 1)} />
        <InlineLabel label="Сумма" value={`${Math.round(Number(order?.totalPrice || 0))} тг`} />
      </ServiceCard>

      <ServiceCard compact>
        <SectionTitle>Статусы поездки</SectionTitle>
        <InlineLabel label="1" value="Забронировано" accentColor="#38BDF8" />
        <InlineLabel label="2" value="Посадка" />
        <InlineLabel label="3" value="В пути" />
        <InlineLabel label="4" value="Завершено" />
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
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: '#082F49',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 12,
  },
  pillText: {
    color: '#7DD3FC',
    fontWeight: '800',
  },
});
