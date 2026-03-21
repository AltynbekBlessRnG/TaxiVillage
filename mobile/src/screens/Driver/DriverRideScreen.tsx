import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, UserLocationChangeEvent } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { buildRegion, buildRouteCoordinates } from '../../utils/map';

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

  const routeCoordinates = useMemo(
    () =>
      buildRouteCoordinates({
        fromLat: ride?.fromLat,
        fromLng: ride?.fromLng,
        stops: (ride?.stops ?? []).filter(
          (stop): stop is Required<RideStop> => typeof stop.lat === 'number' && typeof stop.lng === 'number',
        ),
        toLat: ride?.toLat,
        toLng: ride?.toLng,
      }),
    [ride],
  );

  const initialRegion = useMemo(
    () =>
      buildRegion(routeCoordinates, {
        latitude: ride?.fromLat ?? 43.2389,
        longitude: ride?.fromLng ?? 76.8897,
      }),
    [ride?.fromLat, ride?.fromLng, routeCoordinates],
  );

  const handleUserLocationChange = useCallback((event: UserLocationChangeEvent) => {
    const coordinate = event.nativeEvent.coordinate;
    if (!coordinate) {
      return;
    }

    setDriverLocation({
      lat: coordinate.latitude,
      lng: coordinate.longitude,
    });
  }, []);

  useEffect(() => {
    if (!ride) {
      return;
    }

    const points = [
      ...routeCoordinates,
      ...(driverLocation ? [{ latitude: driverLocation.lat, longitude: driverLocation.lng }] : []),
    ];
    mapRef.current?.animateToRegion(
      buildRegion(points, {
        latitude: ride.fromLat ?? 43.2389,
        longitude: ride.fromLng ?? 76.8897,
      }),
      350,
    );
  }, [driverLocation, ride, routeCoordinates]);

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
        return 'Ожидает подачи';
      case 'ON_THE_WAY':
        return 'Еду к клиенту';
      case 'DRIVER_ARRIVED':
        return 'На месте';
      case 'IN_PROGRESS':
        return 'В пути';
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
        onUserLocationChange={handleUserLocationChange}
        showsUserLocation
      >
        {ride?.fromLat && ride?.fromLng && (
          <Marker
            coordinate={{ latitude: ride.fromLat, longitude: ride.fromLng }}
            title="Подача"
            pinColor="#2563EB"
          />
        )}

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

        {ride?.toLat && ride?.toLng && (
          <Marker
            coordinate={{ latitude: ride.toLat, longitude: ride.toLng }}
            title="Финиш"
            pinColor="#DC2626"
          />
        )}

        {routeCoordinates.length >= 2 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#3B82F6"
            strokeWidth={4}
            lineDashPattern={[10, 6]}
          />
        )}

        {driverLocation && <Marker coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }} title="Вы" pinColor="#10B981" />}
      </MapView>

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.replace('DriverHome')}>
        <Text style={styles.backBtnText}>← На главную</Text>
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

          {ride && (
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

              <View style={styles.priceLockBox}>
                <Text style={styles.priceLockLabel}>Согласованная цена</Text>
                <Text style={styles.priceLockValue}>{Math.round(agreedPrice)} ₸</Text>
                <Text style={styles.priceLockHint}>Цена зафиксирована пассажиром и больше не редактируется.</Text>
              </View>
            </View>
          )}

          <View style={styles.buttonGroup}>
            {status === 'DRIVER_ASSIGNED' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.onTheWayButton]}
                onPress={() => updateStatus('ON_THE_WAY')}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>Еду к клиенту</Text>
              </TouchableOpacity>
            )}

            {status === 'ON_THE_WAY' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.arrivedButton]}
                onPress={() => updateStatus('DRIVER_ARRIVED')}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>Я на месте</Text>
              </TouchableOpacity>
            )}

            {status === 'DRIVER_ARRIVED' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.inProgressButton]}
                onPress={() => updateStatus('IN_PROGRESS')}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>Клиент в машине</Text>
              </TouchableOpacity>
            )}

            {status === 'IN_PROGRESS' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.completeButton]}
                onPress={completeRide}
                disabled={loading}
              >
                <Text style={styles.completeButtonText}>Завершить поездку</Text>
              </TouchableOpacity>
            )}

            {(status === 'DRIVER_ASSIGNED' ||
              status === 'ON_THE_WAY' ||
              status === 'DRIVER_ARRIVED') && (
              <TouchableOpacity style={styles.cancelButton} onPress={cancelRide} disabled={loading}>
                <Text style={styles.cancelButtonText}>Отменить заказ</Text>
              </TouchableOpacity>
            )}
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
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#09090B',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 12,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: '#27272A',
    maxHeight: '64%',
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#10B981' },
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
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  routePoint: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 15 },
  routeText: { color: '#E4E4E7', fontSize: 15, flex: 1, fontWeight: '500' },
  commentBox: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#27272A' },
  commentLabel: { color: '#71717A', fontSize: 12, marginBottom: 4, fontWeight: '600' },
  commentText: { color: '#FCD34D', fontSize: 14, fontStyle: 'italic' },
  priceLockBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
  },
  priceLockLabel: { color: '#71717A', fontSize: 12, textTransform: 'uppercase', marginBottom: 6 },
  priceLockValue: { color: '#3B82F6', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  priceLockHint: { color: '#A1A1AA', fontSize: 13, lineHeight: 18 },
  buttonGroup: { gap: 12 },
  actionButton: { borderRadius: 20, paddingVertical: 18, alignItems: 'center' },
  actionButtonText: { color: '#000', fontSize: 18, fontWeight: '800' },
  onTheWayButton: { backgroundColor: '#F59E0B' },
  arrivedButton: { backgroundColor: '#F97316' },
  inProgressButton: { backgroundColor: '#3B82F6' },
  completeButton: { backgroundColor: '#10B981' },
  completeButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#1C1C1E',
  },
  cancelButtonText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },
});
