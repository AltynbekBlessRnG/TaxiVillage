import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
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
import { createRidesSocket } from '../../api/socket';
import { loadAuth } from '../../storage/authStorage';
import { buildRegion, buildRouteCoordinates } from '../../utils/map';
import { darkMinimalMapStyle } from '../../utils/mapStyle';
import { resolveRideRoute } from '../../utils/rideRoute';
import { sendDriverLocationUpdate } from '../../location/driverLiveTracking';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverRide'>;

interface RideStop {
  address: string;
  lat?: number;
  lng?: number;
}

interface RideDetails {
  id: string;
  status: string;
  estimatedPrice?: number;
  finalPrice?: number;
  fromAddress: string;
  toAddress: string;
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
  comment?: string;
  stops?: RideStop[];
  passenger?: {
    fullName?: string;
    phone?: string;
  };
}

export const DriverRideScreen: React.FC<Props> = ({ route, navigation }) => {
  const { rideId } = route.params;
  const [status, setStatus] = useState<string>('');
  const [ride, setRide] = useState<RideDetails | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [displayRoute, setDisplayRoute] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const mapRef = useRef<MapView>(null);

  const fetchRide = useCallback(async () => {
    try {
      const response = await apiClient.get(`/rides/${rideId}`);
      const data = response.data as RideDetails;
      setRide(data);
      setStatus(data.status);
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить данные поездки');
    }
  }, [rideId]);

  useEffect(() => {
    fetchRide().catch(() => {});
  }, [fetchRide]);

  useEffect(() => {
    let socket: ReturnType<typeof createRidesSocket> | null = null;
    let mounted = true;

    const init = async () => {
      const auth = await loadAuth();
      if (!auth?.accessToken) {
        return;
      }

      socket = createRidesSocket(auth.accessToken);
      socket.emit('join:ride', rideId);

      socket.on('ride:updated', (updatedRide: RideDetails) => {
        if (!mounted || updatedRide.id !== rideId) {
          return;
        }

        setRide(updatedRide);
        setStatus(updatedRide.status);

        if (updatedRide.status === 'CANCELED' || updatedRide.status === 'COMPLETED') {
          navigation.replace('DriverHome');
        }
      });
    };

    init().catch(() => {});

    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, [navigation, rideId]);

  const fallbackRoute = useMemo(
    () =>
      buildRouteCoordinates({
        fromLat:
          status === 'ON_THE_WAY' || status === 'DRIVER_ASSIGNED' || status === 'DRIVER_ARRIVED'
            ? driverLocation?.lat
            : ride?.fromLat,
        fromLng:
          status === 'ON_THE_WAY' || status === 'DRIVER_ASSIGNED' || status === 'DRIVER_ARRIVED'
            ? driverLocation?.lng
            : ride?.fromLng,
        stops:
          status === 'IN_PROGRESS'
            ? (ride?.stops ?? []).filter(
                (stop): stop is Required<RideStop> => typeof stop.lat === 'number' && typeof stop.lng === 'number',
              )
            : [],
        toLat:
          status === 'ON_THE_WAY' || status === 'DRIVER_ASSIGNED' || status === 'DRIVER_ARRIVED'
            ? ride?.fromLat
            : ride?.toLat,
        toLng:
          status === 'ON_THE_WAY' || status === 'DRIVER_ASSIGNED' || status === 'DRIVER_ARRIVED'
            ? ride?.fromLng
            : ride?.toLng,
      }),
    [driverLocation?.lat, driverLocation?.lng, ride?.fromLat, ride?.fromLng, ride?.stops, ride?.toLat, ride?.toLng, status],
  );

  useEffect(() => {
    if (!ride) {
      return;
    }

    const timeoutId = setTimeout(() => {
      resolveRideRoute({
        status,
        fromCoord: ride.fromLat && ride.fromLng ? { lat: ride.fromLat, lng: ride.fromLng } : null,
        toCoord: ride.toLat && ride.toLng ? { lat: ride.toLat, lng: ride.toLng } : null,
        driverCoord: driverLocation,
        stops: (ride.stops ?? [])
          .filter((stop) => typeof stop.lat === 'number' && typeof stop.lng === 'number')
          .map((stop) => ({
            address: stop.address,
            lat: stop.lat as number,
            lng: stop.lng as number,
          })),
      })
        .then((result) => {
          setDisplayRoute(result.coordinates.length > 0 ? result.coordinates : fallbackRoute);
        })
        .catch(() => setDisplayRoute(fallbackRoute));
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [driverLocation, fallbackRoute, ride, status]);

  const initialRegion = useMemo(
    () =>
      buildRegion(displayRoute.length > 0 ? displayRoute : fallbackRoute, {
        latitude: ride?.fromLat ?? 43.2389,
        longitude: ride?.fromLng ?? 76.8897,
      }),
    [displayRoute, fallbackRoute, ride?.fromLat, ride?.fromLng],
  );

  const handleUserLocationChange = useCallback((event: UserLocationChangeEvent) => {
    const coordinate = event.nativeEvent.coordinate;
    if (!coordinate) {
      return;
    }

    const nextLocation = {
      lat: coordinate.latitude,
      lng: coordinate.longitude,
    };

    setDriverLocation(nextLocation);
    sendDriverLocationUpdate(nextLocation).catch(() => {});
  }, []);

  const updateStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      await apiClient.post(`/rides/${rideId}/status`, { status: newStatus });
      setStatus(newStatus);
      if (newStatus === 'CANCELED') {
        navigation.replace('DriverHome');
        return;
      }
      await fetchRide();
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось обновить статус');
    } finally {
      setLoading(false);
    }
  };

  const completeRide = async () => {
    setLoading(true);
    try {
      await apiClient.post(`/rides/${rideId}/complete`, {});
      setStatus('COMPLETED');
      navigation.replace('DriverHome');
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось завершить поездку');
    } finally {
      setLoading(false);
    }
  };

  const cancelRide = () => {
    Alert.alert('Отмена заказа', 'Вы уверены, что хотите отменить этот заказ?', [
      { text: 'Нет', style: 'cancel' },
      {
        text: 'Да, отменить',
        style: 'destructive',
        onPress: () => {
          updateStatus('CANCELED').catch(() => {});
        },
      },
    ]);
  };

  const getStatusText = (value: string) => {
    switch (value) {
      case 'DRIVER_ASSIGNED':
      case 'ON_THE_WAY':
        return 'Еду к клиенту';
      case 'DRIVER_ARRIVED':
        return 'На месте';
      case 'IN_PROGRESS':
        return 'В путь';
      case 'COMPLETED':
        return 'Завершено';
      default:
        return value;
    }
  };

  const agreedPrice = ride?.finalPrice ?? ride?.estimatedPrice ?? 0;

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
        {ride?.fromLat && ride?.fromLng ? (
          <Marker coordinate={{ latitude: ride.fromLat, longitude: ride.fromLng }} title="Подача" pinColor="#2563EB" />
        ) : null}

        {ride?.stops
          ?.filter((stop): stop is Required<RideStop> => typeof stop.lat === 'number' && typeof stop.lng === 'number')
          .map((stop, index) => (
            <Marker
              key={`${rideId}-stop-${index}`}
              coordinate={{ latitude: stop.lat, longitude: stop.lng }}
              title={stop.address}
              pinColor="#F97316"
            />
          ))}

        {ride?.toLat && ride?.toLng ? (
          <Marker coordinate={{ latitude: ride.toLat, longitude: ride.toLng }} title="Назначение" pinColor="#DC2626" />
        ) : null}

        {(displayRoute.length > 0 ? displayRoute : fallbackRoute).length >= 2 ? (
          <Polyline coordinates={displayRoute.length > 0 ? displayRoute : fallbackRoute} strokeColor="#3B82F6" strokeWidth={4} />
        ) : null}

        {driverLocation ? (
          <Marker coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }} title="Вы" pinColor="#10B981" />
        ) : null}
      </MapView>

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.replace('DriverHome')}>
        <Text style={styles.backBtnText}>← На главную</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.recenterBtn}
        onPress={() => {
          if (!ride) {
            return;
          }
          const points = [
            ...(displayRoute.length > 0 ? displayRoute : fallbackRoute),
            ...(driverLocation ? [{ latitude: driverLocation.lat, longitude: driverLocation.lng }] : []),
          ];
          mapRef.current?.animateToRegion(
            buildRegion(points, {
              latitude: ride.fromLat ?? 43.2389,
              longitude: ride.fromLng ?? 76.8897,
            }),
            350,
          );
        }}
      >
        <Text style={styles.recenterBtnText}>⌖</Text>
      </TouchableOpacity>

      <View style={styles.bottomSheet}>
        <View style={styles.handleBar} />

        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{Math.round(agreedPrice)} ₸</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{getStatusText(status)}</Text>
            </View>
          </View>

          {ride ? (
            <View style={styles.routeCard}>
              <View style={styles.routePoint}>
                <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.routeText}>{ride.fromAddress}</Text>
              </View>

              {ride.stops?.map((stop, idx) => (
                <View key={`${stop.address}-${idx}`} style={styles.routePoint}>
                  <View style={[styles.dot, { backgroundColor: '#F97316' }]} />
                  <Text style={styles.routeText}>Заезд: {stop.address}</Text>
                </View>
              ))}

              <View style={styles.routePoint}>
                <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.routeText}>{ride.toAddress}</Text>
              </View>

              {ride.comment ? (
                <View style={styles.commentBox}>
                  <Text style={styles.commentLabel}>Комментарий:</Text>
                  <Text style={styles.commentText}>{ride.comment}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.buttonGroup}>
            {(status === 'ON_THE_WAY' || status === 'DRIVER_ASSIGNED') ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.arrivedButton]}
                onPress={() => updateStatus('DRIVER_ARRIVED')}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>Я на местехуй</Text>
              </TouchableOpacity>
            ) : null}

            {status === 'DRIVER_ARRIVED' ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.inProgressButton]}
                onPress={() => updateStatus('IN_PROGRESS')}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>В путь</Text>
              </TouchableOpacity>
            ) : null}

            {status === 'IN_PROGRESS' ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.completeButton]}
                onPress={completeRide}
                disabled={loading}
              >
                <Text style={styles.completeButtonText}>Завершить поездку</Text>
              </TouchableOpacity>
            ) : null}

            {(status === 'ON_THE_WAY' || status === 'DRIVER_ASSIGNED' || status === 'DRIVER_ARRIVED') ? (
              <TouchableOpacity style={styles.cancelButton} onPress={cancelRide} disabled={loading}>
                <Text style={styles.cancelButtonText}>Отменить заказ</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
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
  recenterBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  recenterBtnText: { color: '#F4F4F5', fontSize: 18, fontWeight: '700' },
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
    marginBottom: 20,
  },
  scrollContent: { flexGrow: 0 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '900', color: '#10B981' },
  statusBadge: {
    backgroundColor: '#18181B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  statusBadgeText: { color: '#A1A1AA', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  routeCard: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  routePoint: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 15 },
  routeText: { color: '#E4E4E7', fontSize: 13, flex: 1, fontWeight: '500' },
  commentBox: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#27272A' },
  commentLabel: { color: '#71717A', fontSize: 12, marginBottom: 4, fontWeight: '600' },
  commentText: { color: '#FCD34D', fontSize: 13, fontStyle: 'italic' },
  buttonGroup: { gap: 10 },
  actionButton: { borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  actionButtonText: { color: '#000', fontSize: 17, fontWeight: '800' },
  arrivedButton: { backgroundColor: '#F97316' },
  inProgressButton: { backgroundColor: '#3B82F6' },
  completeButton: { backgroundColor: '#10B981' },
  completeButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  cancelButton: {
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#1C1C1E',
  },
  cancelButtonText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
});
