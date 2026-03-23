import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, UserLocationChangeEvent } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createCourierOrdersSocket } from '../../api/socket';
import { loadAuth } from '../../storage/authStorage';
import { buildRegion, buildRouteCoordinates } from '../../utils/map';
import { darkMinimalMapStyle } from '../../utils/mapStyle';
import { getGoogleDirections } from '../../utils/googleMaps';
import { sendCourierLocationUpdate } from '../../location/courierLiveTracking';

type Props = NativeStackScreenProps<RootStackParamList, 'CourierOrder'>;

const statusLabels: Record<string, string> = {
  SEARCHING_COURIER: 'Ожидает курьера',
  TO_PICKUP: 'Едет к вам',
  COURIER_ARRIVED: 'На месте',
  TO_RECIPIENT: 'Едет к получателю',
  PICKED_UP: 'Едет к получателю',
  DELIVERING: 'Едет к получателю',
  DELIVERED: 'Доставлено',
  CANCELED: 'Отменено',
};

export const CourierOrderScreen: React.FC<Props> = ({ navigation, route }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [courierLocation, setCourierLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [displayRoute, setDisplayRoute] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const orderId = route.params?.orderId;
  const mapRef = useRef<MapView>(null);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      let resolvedOrderId = orderId;
      if (!resolvedOrderId) {
        const current = await apiClient.get('/couriers/current-order');
        resolvedOrderId = current.data?.id;
      }

      if (!resolvedOrderId) {
        setOrder(null);
        return;
      }

      const response = await apiClient.get(`/courier-orders/${resolvedOrderId}`);
      setOrder(response.data);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось загрузить заказ';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder().catch(() => null);
  }, [loadOrder]);

  useEffect(() => {
    let socket: ReturnType<typeof createCourierOrdersSocket> | null = null;
    let mounted = true;

    const init = async () => {
      const auth = await loadAuth();
      if (!auth?.accessToken) {
        return;
      }

      socket = createCourierOrdersSocket(auth.accessToken);
      if (orderId) {
        socket.emit('join:courier-order', orderId);
      }

      socket.on('courier-order:updated', (updatedOrder: any) => {
        if (!mounted) {
          return;
        }

        if (orderId && updatedOrder.id !== orderId) {
          return;
        }

        setOrder(updatedOrder);
        if (updatedOrder.status === 'DELIVERED' || updatedOrder.status === 'CANCELED') {
          navigation.replace('DriverHome');
        }
      });
    };

    init().catch(() => null);

    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, [navigation, orderId]);

  const fallbackRoute = useMemo(
    () =>
      buildRouteCoordinates({
        fromLat: courierLocation?.lat,
        fromLng: courierLocation?.lng,
        toLat:
          order?.status === 'TO_RECIPIENT' || order?.status === 'PICKED_UP' || order?.status === 'DELIVERING'
            ? order?.dropoffLat
            : order?.pickupLat,
        toLng:
          order?.status === 'TO_RECIPIENT' || order?.status === 'PICKED_UP' || order?.status === 'DELIVERING'
            ? order?.dropoffLng
            : order?.pickupLng,
      }),
    [courierLocation?.lat, courierLocation?.lng, order?.dropoffLat, order?.dropoffLng, order?.pickupLat, order?.pickupLng, order?.status],
  );

  useEffect(() => {
    if (!order || !courierLocation) {
      setDisplayRoute(fallbackRoute);
      return;
    }

    const destination =
      order.status === 'TO_RECIPIENT' || order.status === 'PICKED_UP' || order.status === 'DELIVERING'
        ? { lat: order.dropoffLat, lng: order.dropoffLng }
        : { lat: order.pickupLat, lng: order.pickupLng };

    if (!destination?.lat || !destination?.lng) {
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

  const initialRegion = useMemo(
    () =>
      buildRegion(displayRoute.length > 0 ? displayRoute : fallbackRoute, {
        latitude: order?.pickupLat ?? 43.2389,
        longitude: order?.pickupLng ?? 76.8897,
      }),
    [displayRoute, fallbackRoute, order?.pickupLat, order?.pickupLng],
  );

  const updateStatus = async (status: string) => {
    if (!order?.id) {
      return;
    }
    try {
      await apiClient.post(`/courier-orders/${order.id}/status`, { status });
      await loadOrder();
      if (status === 'DELIVERED') {
        navigation.replace('DriverHome');
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось обновить статус';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    }
  };

  const handleUserLocationChange = useCallback((event: UserLocationChangeEvent) => {
    const coordinate = event.nativeEvent.coordinate;
    if (!coordinate) {
      return;
    }

    const nextLocation = {
      lat: coordinate.latitude,
      lng: coordinate.longitude,
    };

    setCourierLocation(nextLocation);
    sendCourierLocationUpdate(nextLocation).catch(() => {});
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

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
        onUserLocationChange={handleUserLocationChange}
        showsUserLocation
      >
        {order?.pickupLat && order?.pickupLng ? (
          <Marker coordinate={{ latitude: order.pickupLat, longitude: order.pickupLng }} title="Точка забора" pinColor="#2563EB" />
        ) : null}
        {order?.dropoffLat && order?.dropoffLng ? (
          <Marker coordinate={{ latitude: order.dropoffLat, longitude: order.dropoffLng }} title="Получатель" pinColor="#DC2626" />
        ) : null}
        {(displayRoute.length > 0 ? displayRoute : fallbackRoute).length >= 2 ? (
          <Polyline coordinates={displayRoute.length > 0 ? displayRoute : fallbackRoute} strokeColor="#F59E0B" strokeWidth={4} />
        ) : null}
      </MapView>

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.replace('DriverHome')}>
        <Text style={styles.backBtnText}>← K home курьера</Text>
      </TouchableOpacity>

      <View style={styles.bottomSheet}>
        <View style={styles.handleBar} />
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>{statusLabels[order?.status] || 'Доставка'}</Text>
        </View>

        <View style={styles.routeCard}>
          <View style={styles.routePoint}>
            <View style={[styles.dot, { backgroundColor: '#2563EB' }]} />
            <Text style={styles.routeText}>{order?.pickupAddress || '-'}</Text>
          </View>
          <View style={styles.routePoint}>
            <View style={[styles.dot, { backgroundColor: '#DC2626' }]} />
            <Text style={styles.routeText}>{order?.dropoffAddress || '-'}</Text>
          </View>
        </View>

        <Text style={styles.itemText}>{order?.itemDescription || '-'}</Text>

        {order?.status === 'TO_PICKUP' ? (
          <TouchableOpacity style={[styles.actionButton, styles.arrivedButton]} onPress={() => updateStatus('COURIER_ARRIVED')}>
            <Text style={styles.actionButtonText}>На месте</Text>
          </TouchableOpacity>
        ) : null}

        {(order?.status === 'COURIER_ARRIVED' || order?.status === 'PICKED_UP') ? (
          <TouchableOpacity style={[styles.actionButton, styles.inProgressButton]} onPress={() => updateStatus('TO_RECIPIENT')}>
            <Text style={styles.actionButtonText}>Еду к получателю</Text>
          </TouchableOpacity>
        ) : null}

        {(order?.status === 'TO_RECIPIENT' || order?.status === 'DELIVERING') ? (
          <TouchableOpacity style={[styles.actionButton, styles.completeButton]} onPress={() => updateStatus('DELIVERED')}>
            <Text style={styles.completeButtonText}>Доставлено</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090B',
  },
  backBtn: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: '#18181B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    zIndex: 10,
  },
  backBtnText: { color: '#F4F4F5', fontSize: 14, fontWeight: '600' },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#09090B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    maxHeight: '40%',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#27272A',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#3F2B05',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusBadgeText: {
    color: '#FCD34D',
    fontWeight: '800',
  },
  routeCard: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  routePoint: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 15 },
  routeText: { color: '#E4E4E7', fontSize: 13, flex: 1, fontWeight: '500' },
  itemText: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  actionButton: { borderRadius: 16, paddingVertical: 13, alignItems: 'center', marginBottom: 10 },
  actionButtonText: { color: '#000', fontSize: 17, fontWeight: '800' },
  arrivedButton: { backgroundColor: '#F59E0B' },
  inProgressButton: { backgroundColor: '#3B82F6' },
  completeButton: { backgroundColor: '#10B981' },
  completeButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
