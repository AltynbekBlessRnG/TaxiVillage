import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createCourierOrdersSocket } from '../../api/socket';
import { loadAuth } from '../../storage/authStorage';
import { buildRegion, buildRouteCoordinates } from '../../utils/map';
import { darkMinimalMapStyle } from '../../utils/mapStyle';
import { getGoogleDirections } from '../../utils/googleMaps';

type Props = NativeStackScreenProps<RootStackParamList, 'CourierStatus'>;

const statusLabels: Record<string, string> = {
  SEARCHING_COURIER: 'Ищем курьера',
  TO_PICKUP: 'Курьер едет к вам',
  COURIER_ARRIVED: 'Курьер на месте',
  TO_RECIPIENT: 'Курьер едет к получателю',
  PICKED_UP: 'Курьер едет к получателю',
  DELIVERING: 'Курьер едет к получателю',
  DELIVERED: 'Доставлено',
  CANCELED: 'Заказ отменен',
};

export const CourierStatusScreen: React.FC<Props> = ({ navigation, route }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [courierLocation, setCourierLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [displayRoute, setDisplayRoute] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [isFollowingCourier, setIsFollowingCourier] = useState(true);
  const mapRef = useRef<MapView>(null);

  const loadOrder = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const response = await apiClient.get(`/courier-orders/${route.params.orderId}`);
      const nextOrder = response.data;
      setOrder(nextOrder);

      if (nextOrder?.courier?.lat != null && nextOrder?.courier?.lng != null) {
        setCourierLocation({
          lat: nextOrder.courier.lat,
          lng: nextOrder.courier.lng,
        });
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось загрузить статус доставки';
      if (!silent) {
        Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [route.params.orderId]);

  useEffect(() => {
    loadOrder().catch(() => null);
  }, [loadOrder]);

  useFocusEffect(
    useCallback(() => {
      loadOrder(true).catch(() => null);
      const intervalId = setInterval(() => {
        loadOrder(true).catch(() => null);
      }, 30000);

      return () => clearInterval(intervalId);
    }, [loadOrder]),
  );

  useEffect(() => {
    let socket: ReturnType<typeof createCourierOrdersSocket> | null = null;
    let mounted = true;

    const init = async () => {
      const auth = await loadAuth();
      if (!auth?.accessToken) {
        return;
      }

      socket = createCourierOrdersSocket(auth.accessToken);
      socket.emit('join:courier-order', route.params.orderId);

      socket.on('courier-order:updated', (updatedOrder: any) => {
        if (!mounted || updatedOrder.id !== route.params.orderId) {
          return;
        }

        setOrder(updatedOrder);
        if (updatedOrder?.courier?.lat != null && updatedOrder?.courier?.lng != null) {
          setCourierLocation({
            lat: updatedOrder.courier.lat,
            lng: updatedOrder.courier.lng,
          });
        }
      });

      socket.on('courier:moved', (payload: { orderId: string; lat: number; lng: number }) => {
        if (!mounted || payload.orderId !== route.params.orderId) {
          return;
        }

        setCourierLocation({
          lat: payload.lat,
          lng: payload.lng,
        });
      });
    };

    init().catch(() => null);

    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, [route.params.orderId]);

  const fallbackRoute = useMemo(() => {
    if (!order) {
      return [];
    }

    if (order.status === 'SEARCHING_COURIER') {
      return buildRouteCoordinates({
        fromLat: order.pickupLat,
        fromLng: order.pickupLng,
        toLat: order.dropoffLat,
        toLng: order.dropoffLng,
      });
    }

    const destination =
      order.status === 'TO_RECIPIENT' || order.status === 'PICKED_UP' || order.status === 'DELIVERING'
        ? { lat: order.dropoffLat, lng: order.dropoffLng }
        : { lat: order.pickupLat, lng: order.pickupLng };

    return buildRouteCoordinates({
      fromLat: courierLocation?.lat,
      fromLng: courierLocation?.lng,
      toLat: destination.lat,
      toLng: destination.lng,
    });
  }, [courierLocation?.lat, courierLocation?.lng, order]);

  useEffect(() => {
    if (!order) {
      setDisplayRoute([]);
      return;
    }

    if (order.status === 'SEARCHING_COURIER') {
      setDisplayRoute(fallbackRoute);
      return;
    }

    const destination =
      order.status === 'TO_RECIPIENT' || order.status === 'PICKED_UP' || order.status === 'DELIVERING'
        ? { lat: order.dropoffLat, lng: order.dropoffLng }
        : { lat: order.pickupLat, lng: order.pickupLng };

    if (!courierLocation || !destination?.lat || !destination?.lng) {
      setDisplayRoute(fallbackRoute);
      return;
    }

    getGoogleDirections({
      origin: courierLocation,
      destination,
    })
      .then((result) => setDisplayRoute(result.coordinates.length > 0 ? result.coordinates : fallbackRoute))
      .catch(() => setDisplayRoute(fallbackRoute));
  }, [courierLocation, fallbackRoute, order]);

  const mapPoints = useMemo(() => {
    const points: Array<{ latitude: number; longitude: number }> = [];

    if (courierLocation) {
      points.push({ latitude: courierLocation.lat, longitude: courierLocation.lng });
    }
    if (order?.pickupLat && order?.pickupLng) {
      points.push({ latitude: order.pickupLat, longitude: order.pickupLng });
    }
    if (order?.dropoffLat && order?.dropoffLng) {
      points.push({ latitude: order.dropoffLat, longitude: order.dropoffLng });
    }

    return points;
  }, [courierLocation, order?.dropoffLat, order?.dropoffLng, order?.pickupLat, order?.pickupLng]);

  const initialRegion = useMemo(
    () =>
      buildRegion(displayRoute.length > 0 ? displayRoute : mapPoints, {
        latitude: order?.pickupLat ?? 43.2389,
        longitude: order?.pickupLng ?? 76.8897,
      }),
    [displayRoute, mapPoints, order?.pickupLat, order?.pickupLng],
  );

  useEffect(() => {
    if (!mapRef.current || mapPoints.length === 0 || !isFollowingCourier) {
      return;
    }

    mapRef.current.animateToRegion(initialRegion, 500);
  }, [initialRegion, isFollowingCourier, mapPoints.length]);

  if (loading && !order) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  const statusLabel = statusLabels[order?.status] ?? 'Курьерский заказ';
  const price = order?.estimatedPrice != null ? `${Math.round(Number(order.estimatedPrice))} тг` : 'Уточняется';
  const routeToRender = displayRoute.length > 0 ? displayRoute : fallbackRoute;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        mapType="standard"
        customMapStyle={darkMinimalMapStyle}
        onPanDrag={() => setIsFollowingCourier(false)}
      >
        {courierLocation ? (
          <Marker coordinate={{ latitude: courierLocation.lat, longitude: courierLocation.lng }} title="Курьер" pinColor="#F59E0B" />
        ) : null}
        {order?.pickupLat && order?.pickupLng ? (
          <Marker coordinate={{ latitude: order.pickupLat, longitude: order.pickupLng }} title="Точка забора" pinColor="#2563EB" />
        ) : null}
        {order?.dropoffLat && order?.dropoffLng ? (
          <Marker coordinate={{ latitude: order.dropoffLat, longitude: order.dropoffLng }} title="Получатель" pinColor="#DC2626" />
        ) : null}
        {routeToRender.length >= 2 ? (
          <Polyline coordinates={routeToRender} strokeColor="#F59E0B" strokeWidth={4} />
        ) : null}
      </MapView>

      {!isFollowingCourier ? (
        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={() => {
            setIsFollowingCourier(true);
            mapRef.current?.animateToRegion(initialRegion, 500);
          }}
        >
          <Text style={styles.recenterBtnText}>⌖</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('PassengerHome', {})}>
        <Text style={styles.backBtnText}>← На главную</Text>
      </TouchableOpacity>

      <View style={styles.bottomSheet}>
        <View style={styles.handleBar} />
        <ScrollView
          showsVerticalScrollIndicator={false}
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
        >
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{statusLabel}</Text>
          </View>

          <View style={styles.routeCard}>
            <View style={styles.routePoint}>
              <View style={[styles.dot, { backgroundColor: '#2563EB' }]} />
              <Text style={styles.routeText}>{order?.pickupAddress || 'Точка забора'}</Text>
            </View>
            <View style={styles.routePoint}>
              <View style={[styles.dot, { backgroundColor: '#DC2626' }]} />
              <Text style={styles.routeText}>{order?.dropoffAddress || 'Точка доставки'}</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Что везем</Text>
            <Text style={styles.infoValue}>{order?.itemDescription || 'Посылка'}</Text>
            <Text style={styles.infoLabel}>Вес</Text>
            <Text style={styles.infoValue}>{order?.packageWeight || 'Не указан'}</Text>
            <Text style={styles.infoLabel}>Размер</Text>
            <Text style={styles.infoValue}>{order?.packageSize || 'Не указан'}</Text>
            <Text style={styles.infoLabel}>Комментарий</Text>
            <Text style={styles.infoValue}>{order?.comment || 'Нет комментария'}</Text>
            <Text style={styles.infoLabel}>Цена</Text>
            <Text style={[styles.infoValue, styles.priceValue]}>{price}</Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090B',
  },
  backBtn: {
    position: 'absolute',
    top: 52,
    left: 18,
    backgroundColor: '#18181B',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    zIndex: 10,
  },
  recenterBtn: {
    position: 'absolute',
    top: 52,
    right: 18,
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  recenterBtnText: {
    color: '#F4F4F5',
    fontSize: 20,
    fontWeight: '800',
  },
  backBtnText: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '44%',
    backgroundColor: '#111113',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
    marginBottom: 14,
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
  routeCard: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 18,
    padding: 14,
    gap: 12,
    marginBottom: 14,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 10,
  },
  routeText: {
    flex: 1,
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 18,
    padding: 14,
  },
  infoLabel: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: '#F4F4F5',
    fontSize: 16,
    fontWeight: '800',
  },
  priceValue: {
    color: '#60A5FA',
  },
});
