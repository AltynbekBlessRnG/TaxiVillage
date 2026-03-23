import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  UserLocationChangeEvent,
} from 'react-native-maps';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, logout, setAuthToken } from '../../api/client';
import { createCourierOrdersSocket, createRidesSocket } from '../../api/socket';
import { loadAuth } from '../../storage/authStorage';
import { RideOfferSheet } from '../../components/Driver/RideOfferSheet';
import { DriverSideMenu } from '../../components/Driver/DriverSideMenu';
import { DriverStatusSheet } from '../../components/Driver/DriverStatusSheet';
import {
  startDriverBackgroundTracking,
  stopDriverBackgroundTracking,
} from '../../location/backgroundTracking';
import {
  resetDriverLocationTrackingState,
  sendDriverLocationUpdate,
} from '../../location/driverLiveTracking';
import { resetCourierLocationTrackingState, sendCourierLocationUpdate } from '../../location/courierLiveTracking';
import { buildRegion, buildRouteCoordinates } from '../../utils/map';
import { darkMinimalMapStyle } from '../../utils/mapStyle';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { InlineLabel, PrimaryButton, SecondaryButton, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';
import { getGoogleDirections } from '../../utils/googleMaps';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverHome'>;
type SocketState = 'connected' | 'reconnecting' | 'disconnected';

interface RideOffer {
  id: string;
  fromAddress: string;
  toAddress: string;
  comment?: string;
  stops?: Array<{ address: string; lat: number; lng: number }>;
  estimatedPrice?: number;
  fromLat: number;
  fromLng: number;
  toLat?: number;
  toLng?: number;
  hasRoute?: boolean;
}

export const DriverHomeScreen: React.FC<Props> = ({ navigation }) => {
  const isFocused = useIsFocused();
  const [isOnline, setIsOnline] = useState(false);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState<RideOffer | null>(null);
  const [socketState, setSocketState] = useState<SocketState>('disconnected');
  const [intercityTrips, setIntercityTrips] = useState<any[]>([]);
  const [currentIntercityTrip, setCurrentIntercityTrip] = useState<any>(null);
  const [currentCourierOrder, setCurrentCourierOrder] = useState<any>(null);
  const [availableCourierOrders, setAvailableCourierOrders] = useState<any[]>([]);
  const [courierLocation, setCourierLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [courierRoute, setCourierRoute] = useState<Array<{ latitude: number; longitude: number }>>([]);

  const mapRef = useRef<MapView>(null);

  const loadDriverShell = useCallback(async () => {
    const profileRes = await apiClient.get('/drivers/profile');
    setProfile(profileRes.data);
    setIsOnline(Boolean(profileRes.data?.isOnline));

    if (profileRes.data?.supportsIntercity) {
      const [currentTripRes, myTripsRes] = await Promise.all([
        apiClient.get('/intercity-trips/current').catch(() => ({ data: null })),
        apiClient.get('/intercity-trips/my').catch(() => ({ data: [] })),
      ]);
      setCurrentIntercityTrip(currentTripRes.data);
      setIntercityTrips(Array.isArray(myTripsRes.data) ? myTripsRes.data : []);
    } else {
      setCurrentIntercityTrip(null);
      setIntercityTrips([]);
    }

    if (profileRes.data?.supportsCourier) {
      const [currentCourierRes, availableCourierRes] = await Promise.all([
        apiClient.get('/couriers/current-order').catch(() => ({ data: null })),
        apiClient.get('/courier-orders/available').catch(() => ({ data: [] })),
      ]);
      setCurrentCourierOrder(currentCourierRes.data);
      setAvailableCourierOrders(Array.isArray(availableCourierRes.data) ? availableCourierRes.data : []);
    } else {
      setCurrentCourierOrder(null);
      setAvailableCourierOrders([]);
    }
  }, []);

  useEffect(() => {
    loadDriverShell()
      .catch(() => setProfile({}))
      .finally(() => setProfileReady(true));
  }, [loadDriverShell]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    loadDriverShell().catch(() => {});
  }, [isFocused, loadDriverShell]);

  const ensureBackgroundPermissions = useCallback(async () => {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== 'granted') {
      Alert.alert('Доступ к геолокации', 'Разрешите доступ к геолокации, чтобы выйти на линию.');
      return false;
    }

    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== 'granted') {
      Alert.alert(
        'Фоновая геолокация',
        'Для работы водителя нужно разрешение Always Allow / фоновая геолокация.',
      );
      return false;
    }

    return true;
  }, []);

  const toggleOnline = useCallback(
    async (value: boolean) => {
      if (value) {
        const hasPermissions = await ensureBackgroundPermissions();
        if (!hasPermissions) {
          setIsOnline(false);
          return;
        }

        try {
          const auth = await loadAuth();
          if (auth?.accessToken) {
            setAuthToken(auth.accessToken);
          }
          await apiClient.post('/drivers/status', { isOnline: true });
          if (profile?.driverMode !== 'COURIER') {
            await startDriverBackgroundTracking();
          }
          const [profileRes, currentPosition] = await Promise.all([
            apiClient.get('/drivers/profile'),
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          ]);

          const nextLocation = {
            lat: currentPosition.coords.latitude,
            lng: currentPosition.coords.longitude,
          };

          setProfile(profileRes.data);
          setLocation(nextLocation);
          if (profileRes.data?.driverMode === 'COURIER') {
            setCourierLocation(nextLocation);
            await sendCourierLocationUpdate(nextLocation, { force: true });
          } else {
            await sendDriverLocationUpdate(nextLocation, { force: true });
          }
          mapRef.current?.animateToRegion(
            {
              latitude: nextLocation.lat,
              longitude: nextLocation.lng,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            },
            350,
          );
          setIsOnline(true);
        } catch (e: any) {
          let errorMessage = e?.response?.data?.message || 'Не удалось выйти на линию';
          if (e?.response?.status === 401) {
            errorMessage = 'Сессия устарела. Попробуйте открыть приложение заново или войти еще раз.';
          }
          if (errorMessage.includes('не одобрен')) errorMessage = '⏳ Ваш аккаунт ожидает подтверждения.';
          else if (errorMessage.includes('автомобиле')) errorMessage = '🚗 Заполните информацию об авто в профиле.';
          else if (errorMessage.includes('удостоверения')) errorMessage = '📄 Загрузите фото прав в профиле.';

          await stopDriverBackgroundTracking().catch(() => {});
          setIsOnline(false);
          Alert.alert('Ошибка', errorMessage, [{ text: 'Понятно' }]);
        }
        return;
      }

      setIsOnline(false);
      setIncomingOffer(null);
      resetDriverLocationTrackingState();
      resetCourierLocationTrackingState();
      try {
        await Promise.allSettled([
          profile?.driverMode === 'COURIER'
            ? apiClient.post('/couriers/status', { isOnline: false })
            : apiClient.post('/drivers/status', { isOnline: false }),
          profile?.driverMode === 'COURIER' ? Promise.resolve() : stopDriverBackgroundTracking(),
        ]);
      } catch {
        // Ignore offline cleanup errors.
      }
    },
    [ensureBackgroundPermissions, profile?.driverMode],
  );

  const handleLogout = useCallback(async () => {
    if (isOnline) {
      resetDriverLocationTrackingState();
      resetCourierLocationTrackingState();
      await Promise.allSettled([
        profile?.driverMode === 'COURIER'
          ? apiClient.post('/couriers/status', { isOnline: false })
          : apiClient.post('/drivers/status', { isOnline: false }),
        profile?.driverMode === 'COURIER' ? Promise.resolve() : stopDriverBackgroundTracking(),
      ]);
    }

    await logout();
    navigation.replace('Login');
  }, [isOnline, navigation, profile?.driverMode]);

  const switchDriverMode = useCallback(
    async (driverMode: 'TAXI' | 'COURIER' | 'INTERCITY') => {
      try {
        if (currentRideId || currentCourierOrder || currentIntercityTrip) {
          Alert.alert('Активный заказ', 'Сначала завершите текущий активный заказ или рейс.');
          return;
        }
        const response = await apiClient.post('/drivers/mode', { driverMode });
        setProfile(response.data);
        if (driverMode === 'INTERCITY') {
          setIncomingOffer(null);
          setCurrentRideId(null);
        }
        if (driverMode !== 'COURIER') {
          setCurrentCourierOrder(null);
          setAvailableCourierOrders([]);
        }
        await loadDriverShell();
      } catch (error: any) {
        const message = error?.response?.data?.message || 'Не удалось переключить режим';
        Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
      }
    },
    [currentCourierOrder, currentIntercityTrip, currentRideId, loadDriverShell],
  );

  const acceptRide = useCallback(
    async (rideId: string) => {
      try {
        await apiClient.post(`/rides/${rideId}/accept`);
        setIncomingOffer(null);
        setCurrentRideId(rideId);
        navigation.navigate('DriverRide', { rideId });
      } catch {
        Alert.alert('Ошибка', 'Не удалось принять заказ');
      }
    },
    [navigation],
  );

  const rejectRide = useCallback(async (rideId: string) => {
    try {
      await apiClient.post(`/rides/${rideId}/reject`);
    } catch {
      // Ignore reject errors to keep offer sheet responsive.
    }
    setIncomingOffer(null);
  }, []);

  useEffect(() => {
    let socket: ReturnType<typeof createRidesSocket> | null = null;
    let mounted = true;

    if (!isOnline) {
      setCurrentRideId(null);
      setSocketState('disconnected');
      return;
    }

    const init = async () => {
      try {
        const auth = await loadAuth();
        if (!mounted || !auth?.accessToken) {
          return;
        }

        const res = await apiClient.get('/drivers/current-ride');
        if (mounted && res.data?.id) {
          setCurrentRideId(res.data.id);
        }

        socket = createRidesSocket(auth.accessToken);
        socket.on('connect', () => mounted && setSocketState('connected'));
        socket.on('disconnect', () => mounted && setSocketState('disconnected'));
        socket.on('connect_error', () => mounted && setSocketState('reconnecting'));
        socket.io.on('reconnect_attempt', () => mounted && setSocketState('reconnecting'));
        socket.io.on('reconnect', () => mounted && setSocketState('connected'));

        socket.on('ride:offer', (ride: RideOffer) => {
          if (!mounted || !isOnline) {
            apiClient.post(`/rides/${ride.id}/reject`).catch(() => {});
            return;
          }

          setIncomingOffer(ride);
        });

        socket.on('ride:created', (ride: { id: string }) => {
          if (mounted) {
            setCurrentRideId(ride.id);
          }
        });

        socket.on('ride:updated', (ride: { id: string; status: string }) => {
          if (!mounted) {
            return;
          }

          if (ride.status === 'CANCELED') {
            if (incomingOffer?.id === ride.id) {
              setIncomingOffer(null);
              Alert.alert('Заказ отменен', 'Пассажир отменил заказ');
            }
            setCurrentRideId(null);
            return;
          }

          if (ride.status === 'COMPLETED') {
            setCurrentRideId(null);
            setIncomingOffer(null);
            setIsOnline(true);
            return;
          }

          setCurrentRideId(ride.id);
        });
      } catch {
        if (mounted) {
          setSocketState('disconnected');
        }
      }
    };

    init();

    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, [incomingOffer?.id, isOnline]);

  useEffect(() => {
    let socket: ReturnType<typeof createCourierOrdersSocket> | null = null;
    let mounted = true;

    if (!isOnline || profile?.driverMode !== 'COURIER') {
      return;
    }

    const init = async () => {
      const auth = await loadAuth();
      if (!mounted || !auth?.accessToken) {
        return;
      }

      socket = createCourierOrdersSocket(auth.accessToken);
      socket.on('connect', () => mounted && setSocketState('connected'));
      socket.on('disconnect', () => mounted && setSocketState('disconnected'));
      socket.on('connect_error', () => mounted && setSocketState('reconnecting'));

      socket.on('courier-order:offer', (order: any) => {
        if (!mounted) {
          return;
        }
        setAvailableCourierOrders((prev) => {
          const next = [order, ...prev.filter((item) => item.id !== order.id)];
          return next.slice(0, 5);
        });
      });

      socket.on('courier-order:updated', (order: any) => {
        if (!mounted) {
          return;
        }
        setCurrentCourierOrder((current: any) => (current?.id === order.id || order.courier?.userId ? order : current));
        setAvailableCourierOrders((prev) => prev.filter((item) => item.id !== order.id));
      });
    };

    init().catch(() => null);

    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, [isOnline, profile?.driverMode]);

  const routeCoordinates = useMemo(
    () =>
      incomingOffer
        ? buildRouteCoordinates({
            fromLat: incomingOffer.fromLat,
            fromLng: incomingOffer.fromLng,
            stops: incomingOffer.stops ?? [],
            toLat: incomingOffer.toLat,
            toLng: incomingOffer.toLng,
          })
        : [],
    [incomingOffer],
  );

  const mapRegion = useMemo(() => {
    const points = [
      ...routeCoordinates,
      ...(location ? [{ latitude: location.lat, longitude: location.lng }] : []),
    ];

    return buildRegion(points, {
      latitude: location?.lat ?? 43.2389,
      longitude: location?.lng ?? 76.8897,
    });
  }, [location, routeCoordinates]);

  const recenterMap = useCallback(() => {
    if (!location) {
      return;
    }

    mapRef.current?.animateToRegion(
      {
        latitude: location.lat,
        longitude: location.lng,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      },
      300,
    );
  }, [location]);

  const handleUserLocationChange = useCallback((event: UserLocationChangeEvent) => {
    const coordinate = event.nativeEvent.coordinate;
    if (!coordinate) {
      return;
    }

    const nextLocation = {
      lat: coordinate.latitude,
      lng: coordinate.longitude,
    };

    setLocation(nextLocation);
    setCourierLocation(nextLocation);
    if (isOnline && isFocused && profile?.driverMode !== 'COURIER') {
      sendDriverLocationUpdate(nextLocation).catch(() => {});
    }
    if (isOnline && isFocused && profile?.driverMode === 'COURIER') {
      sendCourierLocationUpdate(nextLocation).catch(() => {});
    }
  }, [isFocused, isOnline, profile?.driverMode]);

  useEffect(() => {
    const order = currentCourierOrder;
    if (!order) {
      setCourierRoute([]);
      return;
    }

    const origin =
      order.status === 'TO_RECIPIENT' || order.status === 'PICKED_UP' || order.status === 'DELIVERING'
        ? courierLocation
        : courierLocation;
    const destination =
      order.status === 'TO_RECIPIENT' || order.status === 'PICKED_UP' || order.status === 'DELIVERING'
        ? { lat: order.dropoffLat, lng: order.dropoffLng }
        : { lat: order.pickupLat, lng: order.pickupLng };

    if (!origin || !destination?.lat || !destination?.lng) {
      setCourierRoute(
        buildRouteCoordinates({
          fromLat: origin?.lat,
          fromLng: origin?.lng,
          toLat: destination?.lat,
          toLng: destination?.lng,
        }),
      );
      return;
    }

    getGoogleDirections({
      origin,
      destination,
    })
      .then((result) => setCourierRoute(result.coordinates))
      .catch(() =>
        setCourierRoute(
          buildRouteCoordinates({
            fromLat: origin.lat,
            fromLng: origin.lng,
            toLat: destination.lat,
            toLng: destination.lng,
          }),
        ),
      );
  }, [courierLocation, currentCourierOrder]);

  if (!profileReady || !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F4F4F5" />
      </View>
    );
  }

  if (profile?.driverMode === 'COURIER' && profile?.supportsCourier) {
    const courierMarkers =
      currentCourierOrder
        ? [
            { id: 'pickup', lat: currentCourierOrder.pickupLat, lng: currentCourierOrder.pickupLng, title: 'Забор', color: '#2563EB' },
            { id: 'dropoff', lat: currentCourierOrder.dropoffLat, lng: currentCourierOrder.dropoffLng, title: 'Получатель', color: '#DC2626' },
          ]
        : availableCourierOrders.slice(0, 3).map((order) => ({
            id: order.id,
            lat: order.pickupLat,
            lng: order.pickupLng,
            title: order.pickupAddress,
            color: '#F59E0B',
          }));

    const courierMapPoints = [
      ...courierRoute,
      ...courierMarkers
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
        .map((point) => ({ latitude: point.lat, longitude: point.lng })),
      ...(courierLocation ? [{ latitude: courierLocation.lat, longitude: courierLocation.lng }] : []),
    ];

    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={buildRegion(courierMapPoints, {
            latitude: courierLocation?.lat ?? 43.2389,
            longitude: courierLocation?.lng ?? 76.8897,
          })}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          mapType="standard"
          customMapStyle={darkMinimalMapStyle}
          onUserLocationChange={handleUserLocationChange}
          showsUserLocation
          followsUserLocation={false}
        >
          {courierMarkers.map((point) => (
            <Marker
              key={point.id}
              coordinate={{ latitude: point.lat, longitude: point.lng }}
              title={point.title}
              pinColor={point.color}
            />
          ))}
          {courierRoute.length >= 2 ? <Polyline coordinates={courierRoute} strokeColor="#F59E0B" strokeWidth={4} /> : null}
        </MapView>

        <ConnectionBanner visible={isOnline && socketState !== 'connected'} />

        <TouchableOpacity style={styles.burgerBtn} onPress={() => setIsMenuOpen(true)}>
          <Text style={styles.iconText}>☰</Text>
        </TouchableOpacity>

        <View style={styles.toggleContainer}>
          <Text style={styles.toggleText}>{isOnline ? 'На линии' : 'Офлайн'}</Text>
          <Switch
            value={isOnline}
            onValueChange={toggleOnline}
            trackColor={{ false: '#475569', true: '#10B981' }}
            thumbColor="#fff"
          />
        </View>

        <TouchableOpacity style={styles.recenterBtn} onPress={recenterMap}>
          <Text style={styles.iconDark}>🎯</Text>
        </TouchableOpacity>

        <View style={styles.modeSwitcher}>
          {profile?.supportsTaxi ? (
            <TouchableOpacity style={[styles.modeChip, profile?.driverMode === 'TAXI' && styles.modeChipActive]} onPress={() => switchDriverMode('TAXI')}>
              <Text style={[styles.modeChipText, profile?.driverMode === 'TAXI' && styles.modeChipTextActive]}>Такси</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.modeChip, styles.modeChipActiveCourier]} onPress={() => switchDriverMode('COURIER')}>
            <Text style={[styles.modeChipText, styles.modeChipTextActive]}>Курьер</Text>
          </TouchableOpacity>
          {profile?.supportsIntercity ? (
            <TouchableOpacity style={[styles.modeChip, profile?.driverMode === 'INTERCITY' && styles.modeChipActiveBlue]} onPress={() => switchDriverMode('INTERCITY')}>
              <Text style={[styles.modeChipText, profile?.driverMode === 'INTERCITY' && styles.modeChipTextActive]}>Межгород</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={[styles.bottomSheet, styles.courierBottomSheet]}>
          <View style={styles.handleBar} />
          {currentCourierOrder ? (
            <>
              <Text style={styles.courierTitle}>Активная доставка</Text>
              <View style={styles.routeCard}>
                <View style={styles.routePoint}>
                  <View style={[styles.dot, { backgroundColor: '#2563EB' }]} />
                  <Text style={styles.routeText}>{currentCourierOrder.pickupAddress}</Text>
                </View>
                <View style={styles.routePoint}>
                  <View style={[styles.dot, { backgroundColor: '#DC2626' }]} />
                  <Text style={styles.routeText}>{currentCourierOrder.dropoffAddress}</Text>
                </View>
              </View>
              <PrimaryButton title="Открыть доставку" onPress={() => navigation.navigate('CourierOrder', { orderId: currentCourierOrder.id })} accentColor="#F59E0B" />
            </>
          ) : availableCourierOrders.length > 0 ? (
            <>
              <Text style={styles.courierTitle}>Ближайшие доставки</Text>
              {availableCourierOrders.slice(0, 2).map((order) => (
                <TouchableOpacity key={order.id} style={styles.intercityTripCard} onPress={async () => {
                  try {
                    await apiClient.post(`/courier-orders/${order.id}/accept`);
                    await loadDriverShell();
                    navigation.navigate('CourierOrder', { orderId: order.id });
                  } catch (error: any) {
                    const message = error?.response?.data?.message || 'Не удалось принять заказ';
                    Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
                  }
                }}>
                  <Text style={styles.intercityTripRoute}>{order.pickupAddress}</Text>
                  <Text style={styles.intercityTripMeta}>
                    {order.dropoffAddress} • {Math.round(Number(order.estimatedPrice || 0))} тг
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <Text style={styles.intercityEmpty}>Пока нет доступных курьерских заказов рядом.</Text>
          )}
        </View>

        <DriverSideMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          profile={profile}
          onNavigate={(screen) => {
            setIsMenuOpen(false);
            navigation.navigate(screen as never);
          }}
          onLogout={handleLogout}
        />
      </View>
    );
  }

  if (profile?.driverMode === 'INTERCITY' && profile?.supportsIntercity) {
    return (
      <ServiceScreen
        accentColor="#38BDF8"
        eyebrow="Driver mode"
        title="Межгород"
        subtitle="Один водительский аккаунт, отдельный режим рейсов и бронирований."
      >
        {profile?.supportsTaxi ? (
          <ServiceCard compact>
            <InlineLabel label="Режим" value="Межгород" accentColor="#38BDF8" />
            <View style={styles.modeButtons}>
              <PrimaryButton title="Такси" onPress={() => switchDriverMode('TAXI')} accentColor="#F4F4F5" />
              <PrimaryButton title="Межгород" onPress={() => switchDriverMode('INTERCITY')} accentColor="#38BDF8" />
            </View>
          </ServiceCard>
        ) : null}

        <ServiceCard>
          <InlineLabel label="Водитель" value={profile?.fullName || profile?.user?.phone || 'Водитель'} />
          <InlineLabel label="Статус" value={profile?.isOnline ? 'На линии' : 'Не на линии'} accentColor="#38BDF8" />
          <InlineLabel label="Доступные режимы" value={profile?.supportsTaxi ? 'Такси + Межгород' : 'Только межгород'} />
          <PrimaryButton
            title={profile?.isOnline ? 'Уйти с линии' : 'Выйти на линию'}
            onPress={() => toggleOnline(!profile?.isOnline)}
            accentColor="#38BDF8"
          />
        </ServiceCard>

        {currentIntercityTrip ? (
          <ServiceCard>
            <Text style={styles.intercityTitle}>Активный рейс</Text>
            <InlineLabel label="Маршрут" value={`${currentIntercityTrip.fromCity} -> ${currentIntercityTrip.toCity}`} />
            <InlineLabel label="Выезд" value={new Date(currentIntercityTrip.departureAt).toLocaleString()} />
            <InlineLabel label="Бронирований" value={String(currentIntercityTrip.bookings?.length || 0)} />
            <PrimaryButton
              title="Открыть рейс"
              onPress={() => navigation.navigate('IntercityTrip', { tripId: currentIntercityTrip.id })}
              accentColor="#38BDF8"
            />
          </ServiceCard>
        ) : null}

        <ServiceCard compact>
          <Text style={styles.intercityTitle}>Мои рейсы</Text>
          {intercityTrips.length === 0 ? (
            <Text style={styles.intercityEmpty}>Пока нет опубликованных рейсов.</Text>
          ) : (
            intercityTrips.slice(0, 5).map((trip) => (
              <TouchableOpacity key={trip.id} style={styles.intercityTripCard} onPress={() => navigation.navigate('IntercityTrip', { tripId: trip.id })}>
                <Text style={styles.intercityTripRoute}>{`${trip.fromCity} -> ${trip.toCity}`}</Text>
                <Text style={styles.intercityTripMeta}>
                  {new Date(trip.departureAt).toLocaleString()} • {Math.round(Number(trip.pricePerSeat || 0))} тг
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ServiceCard>

        <PrimaryButton title="Создать поездку" onPress={() => navigation.navigate('IntercityTrip', {})} accentColor="#38BDF8" />
        <SecondaryButton title="Профиль водителя" onPress={() => navigation.navigate('DriverProfile')} />
        <SecondaryButton title="Выйти" onPress={handleLogout} />
      </ServiceScreen>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={mapRegion}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        mapType="standard"
        customMapStyle={darkMinimalMapStyle}
        onUserLocationChange={handleUserLocationChange}
        showsUserLocation
        followsUserLocation={false}
      >
        {routeCoordinates.length >= 2 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#3B82F6"
            strokeWidth={4}
            lineDashPattern={[10, 6]}
          />
        )}

        {incomingOffer?.fromLat && incomingOffer?.fromLng && (
          <Marker
            coordinate={{ latitude: incomingOffer.fromLat, longitude: incomingOffer.fromLng }}
            title="Подача"
            pinColor="#2563EB"
          />
        )}

        {incomingOffer?.stops?.map((stop, index) => (
          <Marker
            key={`${incomingOffer.id}-stop-${index}`}
            coordinate={{ latitude: stop.lat, longitude: stop.lng }}
            title={stop.address}
            pinColor="#F97316"
          />
        ))}

        {incomingOffer?.toLat && incomingOffer?.toLng && (
          <Marker
            coordinate={{ latitude: incomingOffer.toLat, longitude: incomingOffer.toLng }}
            title="Назначение"
            pinColor="#DC2626"
          />
        )}

        {location && (
          <Marker coordinate={{ latitude: location.lat, longitude: location.lng }} title="Вы" pinColor="#10B981" />
        )}
      </MapView>

      <ConnectionBanner visible={isOnline && socketState !== 'connected'} />

      <TouchableOpacity style={styles.burgerBtn} onPress={() => setIsMenuOpen(true)}>
        <Text style={styles.iconText}>☰</Text>
      </TouchableOpacity>

      <View style={styles.toggleContainer}>
        <Text style={styles.toggleText}>{isOnline ? 'На линии' : 'Офлайн'}</Text>
        <Switch
          value={isOnline}
          onValueChange={toggleOnline}
          trackColor={{ false: '#475569', true: '#10B981' }}
          thumbColor="#fff"
        />
      </View>

      <TouchableOpacity style={styles.recenterBtn} onPress={recenterMap}>
        <Text style={styles.iconDark}>🎯</Text>
      </TouchableOpacity>

      {profile?.supportsIntercity ? (
        <View style={styles.modeSwitcher}>
          <TouchableOpacity style={[styles.modeChip, profile?.driverMode === 'TAXI' && styles.modeChipActive]} onPress={() => switchDriverMode('TAXI')}>
            <Text style={[styles.modeChipText, profile?.driverMode === 'TAXI' && styles.modeChipTextActive]}>Такси</Text>
          </TouchableOpacity>
          {profile?.supportsCourier ? (
            <TouchableOpacity style={[styles.modeChip, profile?.driverMode === 'COURIER' && styles.modeChipActiveCourier]} onPress={() => switchDriverMode('COURIER')}>
              <Text style={[styles.modeChipText, profile?.driverMode === 'COURIER' && styles.modeChipTextActive]}>Курьер</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.modeChip, profile?.driverMode === 'INTERCITY' && styles.modeChipActiveBlue]} onPress={() => switchDriverMode('INTERCITY')}>
            <Text style={[styles.modeChipText, profile?.driverMode === 'INTERCITY' && styles.modeChipTextActive]}>Межгород</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {incomingOffer ? (
        <RideOfferSheet offer={incomingOffer} onAccept={acceptRide} onReject={rejectRide} />
      ) : (
        <DriverStatusSheet
          isOnline={isOnline}
          currentRideId={currentRideId}
          profile={profile}
          onGoToRide={() => currentRideId && navigation.navigate('DriverRide', { rideId: currentRideId })}
        />
      )}

      <DriverSideMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        profile={profile}
        onNavigate={(screen) => {
          setIsMenuOpen(false);
          navigation.navigate(screen as never);
        }}
        onLogout={handleLogout}
      />
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
  burgerBtn: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 46,
    height: 46,
    backgroundColor: '#18181B',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
    zIndex: 10,
  },
  toggleContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    zIndex: 10,
  },
  toggleText: { color: '#F4F4F5', fontSize: 14, fontWeight: '600', marginRight: 10 },
  recenterBtn: {
    position: 'absolute',
    bottom: 160,
    right: 20,
    width: 50,
    height: 50,
    backgroundColor: '#18181B',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
    zIndex: 10,
  },
  modeSwitcher: {
    position: 'absolute',
    top: 108,
    right: 20,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  modeChip: {
    backgroundColor: '#18181B',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  modeChipActive: {
    backgroundColor: '#27272A',
  },
  modeChipActiveBlue: {
    backgroundColor: '#082F49',
    borderColor: '#0EA5E9',
  },
  modeChipActiveCourier: {
    backgroundColor: '#3F2B05',
    borderColor: '#F59E0B',
  },
  modeChipText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '800',
  },
  modeChipTextActive: {
    color: '#F4F4F5',
  },
  modeButtons: {
    gap: 10,
  },
  intercityTitle: {
    color: '#F4F4F5',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },
  courierTitle: {
    color: '#F4F4F5',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },
  intercityEmpty: {
    color: '#A1A1AA',
    fontSize: 14,
  },
  intercityTripCard: {
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  intercityTripRoute: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  intercityTripMeta: {
    color: '#A1A1AA',
    fontSize: 13,
  },
  courierBottomSheet: {
    maxHeight: '42%',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#111113',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: '#27272A',
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
    marginBottom: 14,
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
  iconText: { fontSize: 24, color: '#fff' },
  iconDark: { fontSize: 22 },
});
