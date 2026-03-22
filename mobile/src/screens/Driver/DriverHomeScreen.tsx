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
import { createRidesSocket } from '../../api/socket';
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
import { buildRegion, buildRouteCoordinates } from '../../utils/map';
import { darkMinimalMapStyle } from '../../utils/mapStyle';
import { ConnectionBanner } from '../../components/ConnectionBanner';

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

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    apiClient
      .get('/drivers/profile')
      .then((res: any) => {
        setProfile(res.data);
        setIsOnline(Boolean(res.data?.isOnline));
      })
      .catch(() => setProfile({}))
      .finally(() => setProfileReady(true));
  }, []);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    apiClient
      .get('/drivers/profile')
      .then((res: any) => {
        setProfile(res.data);
        setIsOnline(Boolean(res.data?.isOnline));
      })
      .catch(() => {});
  }, [isFocused]);

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
          await startDriverBackgroundTracking();
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
          await sendDriverLocationUpdate(nextLocation, { force: true });
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
      try {
        await Promise.allSettled([
          apiClient.post('/drivers/status', { isOnline: false }),
          stopDriverBackgroundTracking(),
        ]);
      } catch {
        // Ignore offline cleanup errors.
      }
    },
    [ensureBackgroundPermissions],
  );

  const handleLogout = useCallback(async () => {
    if (isOnline) {
      resetDriverLocationTrackingState();
      await Promise.allSettled([
        apiClient.post('/drivers/status', { isOnline: false }),
        stopDriverBackgroundTracking(),
      ]);
    }

    await logout();
    navigation.replace('Login');
  }, [isOnline, navigation]);

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
    if (isOnline && isFocused) {
      sendDriverLocationUpdate(nextLocation).catch(() => {});
    }
  }, [isFocused, isOnline]);

  if (!profileReady || !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F4F4F5" />
      </View>
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
  iconText: { fontSize: 24, color: '#fff' },
  iconDark: { fontSize: 22 },
});
