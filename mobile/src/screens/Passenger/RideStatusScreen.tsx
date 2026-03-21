import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createRidesSocket } from '../../api/socket';
import { RideCompletionModal } from '../../components/RideCompletionModal';
import { loadAuth } from '../../storage/authStorage';
import { buildRegion, buildRouteCoordinates } from '../../utils/map';
import { darkMinimalMapStyle } from '../../utils/mapStyle';
import { sendLocalNotification } from '../../utils/notifications';

type Props = NativeStackScreenProps<RootStackParamList, 'RideStatus'>;

interface RideStop {
  address: string;
  lat: number;
  lng: number;
}

interface RideDriver {
  id: string;
  fullName: string;
  phone: string;
  lat?: number;
  lng?: number;
  car?: {
    brand: string;
    model: string;
    color: string;
    plateNumber: string;
  };
}

interface RideData {
  id: string;
  status: string;
  fromAddress: string;
  toAddress: string;
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
  comment?: string;
  stops?: RideStop[];
  estimatedPrice?: number;
  finalPrice?: number;
  driver?: RideDriver;
}

export const RideStatusScreen: React.FC<Props> = ({ route, navigation }) => {
  const { rideId } = route.params;
  const [status, setStatus] = useState<string>('');
  const [ride, setRide] = useState<RideData | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    let isMounted = true;
    let socket: ReturnType<typeof createRidesSocket> | null = null;

    const init = async () => {
      try {
        const auth = await loadAuth();
        const response = await apiClient.get(`/rides/${rideId}`);
        if (!isMounted) {
          return;
        }

        const data = response.data as RideData;
        setRide(data);
        setStatus(data.status);

        if (data.driver?.lat && data.driver?.lng) {
          const nextLocation = { lat: data.driver.lat, lng: data.driver.lng };
          setDriverLocation(nextLocation);
        }

        if (!auth?.accessToken) {
          return;
        }

        socket = createRidesSocket(auth.accessToken);
        socket.emit('join:ride', rideId);

        socket.on('ride:updated', async (updatedRide: RideData) => {
          if (!isMounted || updatedRide.id !== rideId) {
            return;
          }

          setRide(updatedRide);
          setStatus(updatedRide.status);

          if (updatedRide.driver?.lat && updatedRide.driver?.lng) {
            const nextLocation = {
              lat: updatedRide.driver.lat,
              lng: updatedRide.driver.lng,
            };
            setDriverLocation(nextLocation);
          }

          if (updatedRide.status === 'COMPLETED' && !showCompletionModal) {
            await sendLocalNotification(
              'Поездка завершена',
              `К оплате: ${updatedRide.finalPrice || updatedRide.estimatedPrice || 0} ₸`,
            );
            setShowCompletionModal(true);
          }
        });

        socket.on('driver:moved', (payload: { rideId: string; lat: number; lng: number }) => {
          if (!isMounted || payload.rideId !== rideId) {
            return;
          }

          const nextLocation = { lat: payload.lat, lng: payload.lng };
          setDriverLocation(nextLocation);
        });
      } catch {
        Alert.alert('Ошибка', 'Не удалось загрузить данные поездки');
      }
    };

    init();

    return () => {
      isMounted = false;
      socket?.disconnect();
    };
  }, [rideId, showCompletionModal]);

  useEffect(() => {
    if (!ride) {
      return;
    }

    const points = [
      ...buildRouteCoordinates({
        fromLat: ride.fromLat,
        fromLng: ride.fromLng,
        stops: ride.stops ?? [],
        toLat: ride.toLat,
        toLng: ride.toLng,
      }),
      ...(driverLocation ? [{ latitude: driverLocation.lat, longitude: driverLocation.lng }] : []),
    ];

    const region = buildRegion(points, {
      latitude: ride.fromLat ?? 43.2389,
      longitude: ride.fromLng ?? 76.8897,
    });
    mapRef.current?.animateToRegion(region, 350);
  }, [driverLocation, ride]);

  const routeCoordinates = useMemo(
    () =>
      buildRouteCoordinates({
        fromLat: ride?.fromLat,
        fromLng: ride?.fromLng,
        stops: ride?.stops ?? [],
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

  const handleCancel = async () => {
    Alert.alert('Отмена', 'Вы уверены, что хотите отменить поездку?', [
      { text: 'Нет', style: 'cancel' },
      {
        text: 'Да',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.post(`/rides/${rideId}/cancel`);
            navigation.replace('PassengerHome', {});
          } catch (e: any) {
            Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось отменить заказ');
          }
        },
      },
    ]);
  };

  const canCancel =
    status === 'SEARCHING_DRIVER' ||
    status === 'DRIVER_ASSIGNED' ||
    status === 'ON_THE_WAY';
  const price = ride?.finalPrice || ride?.estimatedPrice || 0;

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
      >
        {ride?.fromLat && ride?.fromLng && (
          <Marker
            coordinate={{ latitude: ride.fromLat, longitude: ride.fromLng }}
            title="Подача"
            pinColor="#2563EB"
          />
        )}

        {ride?.stops?.map((stop, index) => (
          <Marker
            key={`${ride.id}-stop-${index}`}
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
            lineDashPattern={[8, 6]}
          />
        )}

        {driverLocation && <Marker coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }} title="Водитель" pinColor="#F59E0B" />}
      </MapView>

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.replace('PassengerHome', {})}>
        <Text style={styles.backBtnText}>← На главную</Text>
      </TouchableOpacity>

      <View style={styles.bottomSheet}>
        <View style={styles.handleBar} />

        <View style={styles.statusHeader}>
          <View style={[styles.statusDot, getStatusDotColor(status)]} />
          <Text style={styles.statusTitle}>{translateStatus(status)}</Text>
        </View>

        {ride?.driver && (
          <View style={styles.card}>
            <View style={styles.driverRow}>
              <View>
                <Text style={styles.driverName}>{ride.driver.fullName || 'Водитель'}</Text>
                <Text style={styles.carInfo}>
                  {ride.driver.car?.brand} {ride.driver.car?.model} • {ride.driver.car?.color}
                </Text>
              </View>
              <View style={styles.plateBox}>
                <Text style={styles.plateText}>{ride.driver.car?.plateNumber}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.routePoint}>
            <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
            <Text style={styles.addressText} numberOfLines={1}>
              {ride?.fromAddress}
            </Text>
          </View>

          {ride?.stops?.map((stop, index) => (
            <View key={`${stop.address}-${index}`} style={styles.routePoint}>
              <View style={[styles.dot, { backgroundColor: '#F97316' }]} />
              <Text style={styles.addressText} numberOfLines={1}>
                Заезд: {stop.address}
              </Text>
            </View>
          ))}

          <View style={styles.routePoint}>
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.addressText} numberOfLines={1}>
              {ride?.toAddress}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Стоимость поездки</Text>
            <Text style={styles.priceValue}>{Math.round(price)} ₸</Text>
          </View>
        </View>

        <View style={styles.buttonsRow}>
          {canCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>Отменить</Text>
            </TouchableOpacity>
          )}

          {ride?.driver && (
            <TouchableOpacity
              style={styles.chatBtn}
              onPress={() => navigation.navigate('ChatScreen', { rideId })}
            >
              <Text style={styles.chatBtnText}>Чат с водителем</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <RideCompletionModal
        visible={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        rideId={rideId}
        finalPrice={price}
        driverName={ride?.driver?.fullName || 'Водитель'}
        onRatingSubmitted={() => navigation.replace('PassengerHome', {})}
      />
    </View>
  );
};

function getStatusDotColor(status: string) {
  switch (status) {
    case 'COMPLETED':
      return { backgroundColor: '#10B981' };
    case 'CANCELED':
      return { backgroundColor: '#EF4444' };
    case 'IN_PROGRESS':
      return { backgroundColor: '#3B82F6' };
    case 'ON_THE_WAY':
    case 'DRIVER_ARRIVED':
      return { backgroundColor: '#F59E0B' };
    case 'DRIVER_ASSIGNED':
      return { backgroundColor: '#FACC15' };
    default:
      return { backgroundColor: '#71717A' };
  }
}

function translateStatus(status: string): string {
  const t: Record<string, string> = {
    SEARCHING_DRIVER: 'Ищем водителя...',
    DRIVER_ASSIGNED: 'Водитель найден',
    ON_THE_WAY: 'Водитель в пути',
    DRIVER_ARRIVED: 'Водитель приехал',
    IN_PROGRESS: 'В поездке',
    COMPLETED: 'Поездка завершена',
    CANCELED: 'Отменена',
  };
  return t[status] || status;
}

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
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#27272A',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  statusTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  card: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  driverRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  driverName: { color: '#F4F4F5', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  carInfo: { color: '#A1A1AA', fontSize: 14, fontWeight: '500' },
  plateBox: { backgroundColor: '#27272A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  plateText: { color: '#F4F4F5', fontSize: 14, fontWeight: '700', textTransform: 'uppercase' },
  routePoint: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  addressText: { color: '#E4E4E7', fontSize: 15, fontWeight: '500', flex: 1 },
  divider: { height: 1, backgroundColor: '#27272A', marginVertical: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { color: '#A1A1AA', fontSize: 14, fontWeight: '500' },
  priceValue: { color: '#3B82F6', fontSize: 22, fontWeight: '800' },
  buttonsRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  cancelBtnText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  chatBtn: {
    flex: 2,
    backgroundColor: '#F4F4F5',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  chatBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
});
