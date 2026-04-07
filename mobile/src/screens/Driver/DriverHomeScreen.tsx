import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
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
import { PrimaryButton } from '../../components/ServiceScreen';
import { getGoogleDirections } from '../../utils/googleMaps';
import { resolveRideRoute } from '../../utils/rideRoute';
import { useNotificationsInbox } from '../../hooks/useNotificationsInbox';
import { useMessagesSummary } from '../../hooks/useMessagesSummary';

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
  pickupLocationPrecision?: 'EXACT' | 'LANDMARK_TEXT';
  dropoffLocationPrecision?: 'EXACT' | 'LANDMARK_TEXT';
  passenger?: { user?: { phone?: string | null } | null } | null;
}

export const DriverHomeScreen: React.FC<Props> = ({ navigation }) => {
  type DriverModalState = {
    visible: boolean;
    title: string;
    message: string;
    primaryLabel: string;
    secondaryLabel?: string;
    primaryVariant?: 'light' | 'danger';
    onPrimary?: (() => void | Promise<void>) | null;
    onSecondary?: (() => void | Promise<void>) | null;
  };

  const isFocused = useIsFocused();
  const [isOnline, setIsOnline] = useState(false);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [currentRide, setCurrentRide] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState<RideOffer | null>(null);
  const [socketState, setSocketState] = useState<SocketState>('disconnected');
  const [intercityTrips, setIntercityTrips] = useState<any[]>([]);
  const [currentIntercityTrip, setCurrentIntercityTrip] = useState<any>(null);
  const [intercityPassengerOrders, setIntercityPassengerOrders] = useState<any[]>([]);
  const [currentCourierOrder, setCurrentCourierOrder] = useState<any>(null);
  const [availableCourierOrders, setAvailableCourierOrders] = useState<any[]>([]);
  const [courierLocation, setCourierLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [courierRoute, setCourierRoute] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [driverRoute, setDriverRoute] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [driverModal, setDriverModal] = useState<DriverModalState>({
    visible: false,
    title: '',
    message: '',
    primaryLabel: 'Понятно',
  });
  const { unreadCount: unreadNotificationsCount } = useNotificationsInbox();
  const { unreadCount: unreadMessagesCount, refresh: refreshMessagesSummary } = useMessagesSummary({ autoRefresh: false });

  const mapRef = useRef<MapView>(null);
  const didBootstrapRef = useRef(false);
  const shellLoadPromiseRef = useRef<Promise<void> | null>(null);
  const lastShellLoadAtRef = useRef(0);

  const loadDriverShell = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && shellLoadPromiseRef.current) {
      return shellLoadPromiseRef.current;
    }

    if (!force && lastShellLoadAtRef.current > 0 && now - lastShellLoadAtRef.current < 1500) {
      return;
    }

    shellLoadPromiseRef.current = (async () => {
      const [profileRes, metricsRes] = await Promise.all([
        apiClient.get('/drivers/profile'),
        apiClient.get('/drivers/metrics', { params: { days: 7 } }).catch(() => ({ data: null })),
      ]);
      let nextProfile = profileRes.data;

      if (
        !nextProfile?.isOnline &&
        nextProfile?.supportsTaxi &&
        nextProfile?.driverMode !== 'TAXI' &&
        !force
      ) {
        try {
          const modeResponse = await apiClient.post('/drivers/mode', { driverMode: 'TAXI' });
          nextProfile = modeResponse.data;
        } catch {
          // Keep the current mode if the server rejects automatic fallback.
        }
      }

      setProfile(nextProfile);
      setIsOnline(Boolean(nextProfile?.isOnline));
      setMetrics(metricsRes.data);

      if (nextProfile?.driverMode === 'TAXI' || nextProfile?.supportsTaxi) {
        const currentRideRes = await apiClient.get('/drivers/current-ride').catch(() => ({ data: null }));
        if (currentRideRes.data?.id) {
          const rideRes = await apiClient.get(`/rides/${currentRideRes.data.id}`).catch(() => ({ data: null }));
          setCurrentRideId(currentRideRes.data.id);
          setCurrentRide(rideRes.data ?? null);
        } else {
          setCurrentRideId(null);
          setCurrentRide(null);
        }
      } else {
        setCurrentRideId(null);
        setCurrentRide(null);
      }

      if (nextProfile?.supportsIntercity) {
        const [currentTripRes, myTripsRes, passengerOrdersRes] = await Promise.all([
          apiClient.get('/intercity-trips/current').catch(() => ({ data: null })),
          apiClient.get('/intercity-trips/my').catch(() => ({ data: [] })),
          apiClient.get('/intercity-orders/available').catch(() => ({ data: [] })),
        ]);
        setCurrentIntercityTrip(currentTripRes.data);
        setIntercityTrips(Array.isArray(myTripsRes.data) ? myTripsRes.data : []);
        setIntercityPassengerOrders(Array.isArray(passengerOrdersRes.data) ? passengerOrdersRes.data : []);
      } else {
        setCurrentIntercityTrip(null);
        setIntercityTrips([]);
        setIntercityPassengerOrders([]);
      }

      if (nextProfile?.supportsCourier) {
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
    })();

    try {
      await shellLoadPromiseRef.current;
      lastShellLoadAtRef.current = Date.now();
    } finally {
      shellLoadPromiseRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const shouldMarkReady = !didBootstrapRef.current;
    didBootstrapRef.current = true;

    loadDriverShell()
      .catch(() => {
        if (shouldMarkReady) {
          setProfile({});
        }
      })
      .finally(() => {
        if (shouldMarkReady) {
          setProfileReady(true);
        }
      });
    refreshMessagesSummary().catch(() => {});
  }, [isFocused, loadDriverShell, refreshMessagesSummary]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    Location.getForegroundPermissionsAsync()
      .then((result) => {
        if (result.status !== 'granted') {
          return Location.requestForegroundPermissionsAsync();
        }
        return result;
      })
      .catch(() => null);
  }, [isFocused]);

  const closeDriverModal = useCallback(() => {
    setDriverModal((current) => ({
      ...current,
      visible: false,
      onPrimary: null,
      onSecondary: null,
    }));
  }, []);

  const openDriverModal = useCallback((config: Omit<DriverModalState, 'visible'>) => {
    setDriverModal({
      visible: true,
      ...config,
    });
  }, []);

  const ensureBackgroundPermissions = useCallback(async () => {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== 'granted') {
      openDriverModal({
        title: 'Доступ к геолокации',
        message: 'Разрешите доступ к геолокации, чтобы выйти на линию.',
        primaryLabel: 'Понятно',
      });
      return false;
    }

    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== 'granted') {
      openDriverModal({
        title: 'Фоновая геолокация',
        message: 'Для работы водителя нужно разрешение Always Allow / фоновая геолокация.',
        primaryLabel: 'Понятно',
      });
      return false;
    }

    return true;
  }, [openDriverModal]);

  const openProfileActionModal = useCallback(
    (title: string, message: string) => {
      openDriverModal({
        title,
        message,
        primaryLabel: 'Открыть профиль',
        secondaryLabel: 'Позже',
        onPrimary: () => navigation.navigate('DriverProfile'),
      });
    },
    [navigation, openDriverModal],
  );

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
          if (errorMessage.includes('не одобрен') || errorMessage.includes('одобрение профиля')) {
            errorMessage = 'Аккаунт еще не одобрен. Откройте профиль и проверьте документы.';
          } else if (errorMessage.includes('автомобиле') || errorMessage.includes('автомобиль')) {
            errorMessage = 'Заполните автомобиль в профиле, чтобы выйти на линию.';
          } else if (
            errorMessage.includes('удостоверения') ||
            errorMessage.includes('водительское удостоверение') ||
            errorMessage.includes('СТС')
          ) {
            errorMessage = 'Загрузите документы в профиле и дождитесь проверки.';
          }

          await stopDriverBackgroundTracking().catch(() => {});
          setIsOnline(false);
          openProfileActionModal('Профиль не готов', errorMessage);
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
    [ensureBackgroundPermissions, openProfileActionModal, profile?.driverMode],
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
            openDriverModal({
              title: 'Активный заказ',
              message: 'Сначала завершите текущий активный заказ или рейс.',
              primaryLabel: 'Понятно',
            });
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
        await loadDriverShell(true);
      } catch (error: any) {
        const message = error?.response?.data?.message || 'Не удалось переключить режим';
        openDriverModal({
          title: 'Ошибка',
          message: Array.isArray(message) ? message.join(', ') : message,
          primaryLabel: 'Понятно',
        });
      }
    },
    [currentCourierOrder, currentIntercityTrip, currentRideId, loadDriverShell, openDriverModal],
  );

  const openIntercityHub = useCallback(async () => {
    try {
      if (currentRideId || currentCourierOrder) {
        openDriverModal({
          title: 'Активный заказ',
          message: 'Сначала завершите текущую поездку или доставку.',
          primaryLabel: 'Понятно',
        });
        return;
      }

      if (profile?.driverMode !== 'INTERCITY') {
        const response = await apiClient.post('/drivers/mode', { driverMode: 'INTERCITY' });
        setProfile(response.data);
      }

      await loadDriverShell(true);
      navigation.navigate('IntercityRequests');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось открыть межгород';
      openDriverModal({
        title: 'Ошибка',
        message: Array.isArray(message) ? message.join(', ') : message,
        primaryLabel: 'Понятно',
      });
    }
  }, [
    currentCourierOrder,
    currentRideId,
    loadDriverShell,
    navigation,
    openDriverModal,
    profile?.driverMode,
  ]);

  const callPhone = useCallback(async (phone?: string | null) => {
    if (!phone) {
      return;
    }

    const telUrl = `tel:${phone}`;
    const canOpen = await Linking.canOpenURL(telUrl);
    if (!canOpen) {
      openDriverModal({
        title: 'Не удалось позвонить',
        message: 'Телефонное приложение недоступно на этом устройстве.',
        primaryLabel: 'Понятно',
      });
      return;
    }

    await Linking.openURL(telUrl);
  }, [openDriverModal]);

  const acceptRide = useCallback(
    async (rideId: string) => {
      try {
        await apiClient.post(`/rides/${rideId}/accept`);
        setIncomingOffer(null);
        const rideRes = await apiClient.get(`/rides/${rideId}`).catch(() => ({ data: null }));
        setCurrentRideId(rideId);
        setCurrentRide(rideRes.data ?? null);
      } catch {
        openDriverModal({
          title: 'Ошибка',
          message: 'Не удалось принять заказ',
          primaryLabel: 'Понятно',
        });
      }
    },
    [openDriverModal],
  );

  const rejectRide = useCallback(async (rideId: string) => {
    try {
      await apiClient.post(`/rides/${rideId}/reject`);
    } catch {
      // Ignore reject errors to keep offer sheet responsive.
    }
    setIncomingOffer(null);
  }, []);

  const acceptCourierOrder = useCallback(
    async (orderId: string) => {
      try {
        await apiClient.post(`/courier-orders/${orderId}/accept`);
        await loadDriverShell(true);
      } catch (error: any) {
        const message = error?.response?.data?.message || 'Не удалось принять доставку';
        openDriverModal({
          title: 'Ошибка',
          message: Array.isArray(message) ? message.join(', ') : message,
          primaryLabel: 'Понятно',
        });
      }
    },
    [loadDriverShell, openDriverModal],
  );

  const updateRideStatus = useCallback(
    async (status: string) => {
      if (!currentRideId) {
        return;
      }

      try {
        await apiClient.post(`/rides/${currentRideId}/status`, { status });
        const rideRes = await apiClient.get(`/rides/${currentRideId}`).catch(() => ({ data: null }));
        setCurrentRide(rideRes.data ?? null);
      } catch (error: any) {
        const message = error?.response?.data?.message || 'Не удалось обновить статус поездки';
        openDriverModal({
          title: 'Ошибка',
          message: Array.isArray(message) ? message.join(', ') : message,
          primaryLabel: 'Понятно',
        });
      }
    },
    [currentRideId, openDriverModal],
  );

  const completeRide = useCallback(async () => {
    if (!currentRideId) {
      return;
    }

    try {
      await apiClient.post(`/rides/${currentRideId}/complete`, {});
      setCurrentRideId(null);
      setCurrentRide(null);
      await loadDriverShell(true);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось завершить поездку';
      openDriverModal({
        title: 'Ошибка',
        message: Array.isArray(message) ? message.join(', ') : message,
        primaryLabel: 'Понятно',
      });
    }
  }, [currentRideId, loadDriverShell, openDriverModal]);

  const cancelRide = useCallback(() => {
    if (!currentRideId) {
      return;
    }

    openDriverModal({
      title: 'Отменить заказ?',
      message: 'Заказ будет снят, а пассажир увидит отмену.',
      primaryLabel: 'Отменить заказ',
      secondaryLabel: 'Назад',
      primaryVariant: 'danger',
      onPrimary: async () => {
        try {
          await apiClient.post(`/rides/${currentRideId}/status`, { status: 'CANCELED' });
          setCurrentRideId(null);
          setCurrentRide(null);
          await loadDriverShell(true);
        } catch (error: any) {
          const message = error?.response?.data?.message || 'Не удалось отменить заказ';
          openDriverModal({
            title: 'Ошибка',
            message: Array.isArray(message) ? message.join(', ') : message,
            primaryLabel: 'Понятно',
          });
        }
      },
    });
  }, [currentRideId, loadDriverShell, openDriverModal]);

  const updateCourierStatus = useCallback(
    async (status: string) => {
      if (!currentCourierOrder?.id) {
        return;
      }

      try {
        await apiClient.post(`/courier-orders/${currentCourierOrder.id}/status`, { status });
        if (status === 'DELIVERED') {
          setCurrentCourierOrder(null);
        }
        await loadDriverShell(true);
      } catch (error: any) {
        const message = error?.response?.data?.message || 'Не удалось обновить статус доставки';
        openDriverModal({
          title: 'Ошибка',
          message: Array.isArray(message) ? message.join(', ') : message,
          primaryLabel: 'Понятно',
        });
      }
    },
    [currentCourierOrder?.id, loadDriverShell, openDriverModal],
  );

  useEffect(() => {
    let socket: ReturnType<typeof createRidesSocket> | null = null;
    let mounted = true;

    if (!isOnline || profile?.driverMode !== 'TAXI') {
      setCurrentRideId(null);
      setIncomingOffer(null);
      setSocketState('disconnected');
      return;
    }

    const init = async () => {
      try {
        const auth = await loadAuth();
        if (!mounted || !auth?.accessToken) {
          return;
        }

        socket = createRidesSocket(auth.accessToken);
        const handleConnect = () => mounted && setSocketState('connected');
        const handleDisconnect = () => mounted && setSocketState('disconnected');
        const handleConnectError = () => mounted && setSocketState('reconnecting');
        const handleReconnectAttempt = () => mounted && setSocketState('reconnecting');
        const handleReconnect = () => mounted && setSocketState('connected');

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleConnectError);
        socket.io?.on?.('reconnect_attempt', handleReconnectAttempt);
        socket.io?.on?.('reconnect', handleReconnect);

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
              openDriverModal({
                title: 'Заказ отменен',
                message: 'Пассажир отменил заказ.',
                primaryLabel: 'Понятно',
              });
            }
            setCurrentRideId(null);
            setCurrentRide(null);
            return;
          }

          if (ride.status === 'COMPLETED') {
            setCurrentRideId(null);
            setCurrentRide(null);
            setIncomingOffer(null);
            setIsOnline(true);
            return;
          }

          setCurrentRideId(ride.id);
          apiClient.get(`/rides/${ride.id}`).then((res) => setCurrentRide(res.data)).catch(() => null);
        });

        return () => {
          socket?.off('connect', handleConnect);
          socket?.off('disconnect', handleDisconnect);
          socket?.off('connect_error', handleConnectError);
          socket?.io?.off?.('reconnect_attempt', handleReconnectAttempt);
          socket?.io?.off?.('reconnect', handleReconnect);
        };
      } catch {
        if (mounted) {
          setSocketState('disconnected');
        }
      }
    };

    let cleanupListeners: (() => void) | undefined;
    init().then((cleanup) => {
      cleanupListeners = cleanup;
    }).catch(() => null);

    return () => {
      mounted = false;
      cleanupListeners?.();
      socket?.disconnect();
    };
  }, [incomingOffer?.id, isOnline, openDriverModal, profile?.driverMode]);

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
      const handleConnect = () => mounted && setSocketState('connected');
      const handleDisconnect = () => mounted && setSocketState('disconnected');
      const handleConnectError = () => mounted && setSocketState('reconnecting');

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('connect_error', handleConnectError);

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
        if (order.status === 'DELIVERED' || order.status === 'CANCELED') {
          setCurrentCourierOrder(null);
        }
      });

      return () => {
        socket?.off('connect', handleConnect);
        socket?.off('disconnect', handleDisconnect);
        socket?.off('connect_error', handleConnectError);
      };
    };

    let cleanupListeners: (() => void) | undefined;
    init().then((cleanup) => {
      cleanupListeners = cleanup;
    }).catch(() => null);

    return () => {
      mounted = false;
      cleanupListeners?.();
      socket?.disconnect();
    };
  }, [isOnline, profile?.driverMode]);

  const currentModeIsCourier = profile?.driverMode === 'COURIER' && profile?.supportsCourier;
  const activeLocation = currentModeIsCourier ? courierLocation ?? location : location;

  const routeCoordinates = useMemo(() => {
    if (currentModeIsCourier) {
      const previewOrder = currentCourierOrder ?? availableCourierOrders[0];
      if (!previewOrder) {
        return [];
      }

      const destination =
        previewOrder.status === 'TO_RECIPIENT' || previewOrder.status === 'PICKED_UP' || previewOrder.status === 'DELIVERING'
          ? { lat: previewOrder.dropoffLat, lng: previewOrder.dropoffLng }
          : { lat: previewOrder.pickupLat, lng: previewOrder.pickupLng };

      const origin = courierLocation ?? location;

      return buildRouteCoordinates({
        fromLat: origin?.lat,
        fromLng: origin?.lng,
        toLat: destination.lat,
        toLng: destination.lng,
      });
    }

    if (currentRide) {
      return buildRouteCoordinates({
        fromLat:
          currentRide.status === 'ON_THE_WAY' || currentRide.status === 'DRIVER_ASSIGNED' || currentRide.status === 'DRIVER_ARRIVED'
            ? location?.lat
            : currentRide.fromLat,
        fromLng:
          currentRide.status === 'ON_THE_WAY' || currentRide.status === 'DRIVER_ASSIGNED' || currentRide.status === 'DRIVER_ARRIVED'
            ? location?.lng
            : currentRide.fromLng,
        stops:
          currentRide.status === 'IN_PROGRESS'
            ? (currentRide.stops ?? []).filter((stop: any) => typeof stop.lat === 'number' && typeof stop.lng === 'number')
            : [],
        toLat:
          currentRide.status === 'ON_THE_WAY' || currentRide.status === 'DRIVER_ASSIGNED' || currentRide.status === 'DRIVER_ARRIVED'
            ? currentRide.fromLat
            : currentRide.toLat,
        toLng:
          currentRide.status === 'ON_THE_WAY' || currentRide.status === 'DRIVER_ASSIGNED' || currentRide.status === 'DRIVER_ARRIVED'
            ? currentRide.fromLng
            : currentRide.toLng,
      });
    }

    return incomingOffer
      ? buildRouteCoordinates({
          fromLat: incomingOffer.fromLat,
          fromLng: incomingOffer.fromLng,
          stops: incomingOffer.stops ?? [],
          toLat: incomingOffer.toLat,
          toLng: incomingOffer.toLng,
        })
      : [];
  }, [availableCourierOrders, courierLocation, currentCourierOrder, currentModeIsCourier, incomingOffer, location]);

  const renderedRouteCoordinates = useMemo(() => {
    if (currentModeIsCourier && currentCourierOrder) {
      return courierRoute.length > 0 ? courierRoute : routeCoordinates;
    }

    if (!currentModeIsCourier && currentRide) {
      return driverRoute.length > 0 ? driverRoute : routeCoordinates;
    }

    return routeCoordinates;
  }, [courierRoute, currentCourierOrder, currentModeIsCourier, currentRide, driverRoute, routeCoordinates]);

  const mapRegion = useMemo(() => {
    const points = [
      ...renderedRouteCoordinates,
      ...(activeLocation ? [{ latitude: activeLocation.lat, longitude: activeLocation.lng }] : []),
    ];

    return buildRegion(points, {
      latitude: activeLocation?.lat ?? 43.2389,
      longitude: activeLocation?.lng ?? 76.8897,
    });
  }, [activeLocation, renderedRouteCoordinates]);

  const recenterMap = useCallback(() => {
    if (!activeLocation) {
      return;
    }

    mapRef.current?.animateToRegion(
      {
        latitude: activeLocation.lat,
        longitude: activeLocation.lng,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      },
      300,
    );
  }, [activeLocation]);

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

  useEffect(() => {
    if (!currentRide) {
      setDriverRoute([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      resolveRideRoute({
        status: currentRide.status,
        fromCoord: currentRide.fromLat && currentRide.fromLng ? { lat: currentRide.fromLat, lng: currentRide.fromLng } : null,
        toCoord: currentRide.toLat && currentRide.toLng ? { lat: currentRide.toLat, lng: currentRide.toLng } : null,
        driverCoord: location,
        stops: (currentRide.stops ?? [])
          .filter((stop: any) => typeof stop.lat === 'number' && typeof stop.lng === 'number')
          .map((stop: any) => ({
            address: stop.address,
            lat: stop.lat,
            lng: stop.lng,
          })),
      })
        .then((result) => setDriverRoute(result.coordinates))
        .catch(() => setDriverRoute(routeCoordinates));
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [currentRide, location, routeCoordinates]);

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
        {renderedRouteCoordinates.length >= 2 && (
          <Polyline
            coordinates={renderedRouteCoordinates}
            strokeColor={currentModeIsCourier ? '#F59E0B' : '#3B82F6'}
            strokeWidth={4}
            lineDashPattern={currentModeIsCourier ? undefined : [10, 6]}
          />
        )}

        {!currentModeIsCourier && currentRide?.fromLat && currentRide?.fromLng ? (
          <Marker
            coordinate={{ latitude: currentRide.fromLat, longitude: currentRide.fromLng }}
            title="Подача"
            pinColor="#2563EB"
          />
        ) : null}

        {!currentModeIsCourier && !currentRide && incomingOffer?.fromLat && incomingOffer?.fromLng && (
          <Marker
            coordinate={{ latitude: incomingOffer.fromLat, longitude: incomingOffer.fromLng }}
            title="Подача"
            pinColor="#2563EB"
          />
        )}

        {!currentModeIsCourier && currentRide?.stops?.map((stop: any, index: number) => (
          <Marker
            key={`${currentRide.id}-stop-${index}`}
            coordinate={{ latitude: stop.lat, longitude: stop.lng }}
            title={stop.address}
            pinColor="#F97316"
          />
        ))}

        {!currentModeIsCourier && !currentRide && incomingOffer?.stops?.map((stop, index) => (
          <Marker
            key={`${incomingOffer.id}-stop-${index}`}
            coordinate={{ latitude: stop.lat, longitude: stop.lng }}
            title={stop.address}
            pinColor="#F97316"
          />
        ))}

        {!currentModeIsCourier && currentRide?.toLat && currentRide?.toLng ? (
          <Marker
            coordinate={{ latitude: currentRide.toLat, longitude: currentRide.toLng }}
            title="Назначение"
            pinColor="#DC2626"
          />
        ) : null}

        {!currentModeIsCourier && !currentRide && incomingOffer?.toLat && incomingOffer?.toLng && (
          <Marker
            coordinate={{ latitude: incomingOffer.toLat, longitude: incomingOffer.toLng }}
            title="Назначение"
            pinColor="#DC2626"
          />
        )}

        {currentModeIsCourier && currentCourierOrder?.pickupLat && currentCourierOrder?.pickupLng ? (
          <Marker
            coordinate={{ latitude: currentCourierOrder.pickupLat, longitude: currentCourierOrder.pickupLng }}
            title="Забор"
            pinColor="#2563EB"
          />
        ) : null}

        {currentModeIsCourier && currentCourierOrder?.dropoffLat && currentCourierOrder?.dropoffLng ? (
          <Marker
            coordinate={{ latitude: currentCourierOrder.dropoffLat, longitude: currentCourierOrder.dropoffLng }}
            title="Получатель"
            pinColor="#DC2626"
          />
        ) : null}

        {currentModeIsCourier && !currentCourierOrder
          ? availableCourierOrders.slice(0, 2).map((order) => (
              <Marker
                key={order.id}
                coordinate={{ latitude: order.pickupLat, longitude: order.pickupLng }}
                title={order.pickupAddress}
                pinColor="#F59E0B"
              />
            ))
          : null}

        {activeLocation && (
          <Marker coordinate={{ latitude: activeLocation.lat, longitude: activeLocation.lng }} title="Вы" pinColor="#10B981" />
        )}
      </MapView>

      <ConnectionBanner visible={isOnline && socketState !== 'connected'} />

      <TouchableOpacity style={styles.burgerBtn} onPress={() => setIsMenuOpen(true)}>
        <Text style={styles.iconText}>☰</Text>
        {unreadNotificationsCount > 0 ? (
          <View style={styles.burgerBadge}>
            <Text style={styles.burgerBadgeText}>
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </Text>
          </View>
        ) : null}
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
        <TouchableOpacity style={[styles.intercityHubBtn, profile?.driverMode === 'INTERCITY' && styles.intercityHubBtnActive]} onPress={openIntercityHub}>
          <Text style={[styles.intercityHubText, profile?.driverMode === 'INTERCITY' && styles.intercityHubTextActive]}>
            Межгород
          </Text>
        </TouchableOpacity>
      ) : null}

      {incomingOffer ? (
        <RideOfferSheet
          offer={incomingOffer}
          onAccept={acceptRide}
          onReject={rejectRide}
          variant="taxi"
        />
      ) : (
        <DriverStatusSheet
          isOnline={isOnline}
          currentRideId={currentRideId}
          currentRide={currentRide}
          profile={profile}
          metrics={metrics}
          onOpenToday={() => navigation.navigate('RideHistory')}
          onSwitchMode={switchDriverMode}
          currentCourierOrder={currentCourierOrder}
          availableCourierOrders={currentModeIsCourier ? availableCourierOrders : []}
          onAcceptCourierOrder={acceptCourierOrder}
          onRideStatusChange={updateRideStatus}
          onCompleteRide={completeRide}
          onCancelRide={cancelRide}
          onCallPassenger={() => {
            void callPhone(currentRide?.passenger?.user?.phone);
          }}
          onOpenRideChat={() => {
            if (currentRideId) {
              navigation.navigate('ChatScreen', { rideId: currentRideId });
            }
          }}
          onCourierStatusChange={updateCourierStatus}
          onShowDriverNotice={(title, message) =>
            openDriverModal({
              title,
              message,
              primaryLabel: 'Понятно',
            })
          }
        />
      )}

      <DriverSideMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        profile={profile}
        unreadNotificationsCount={unreadNotificationsCount}
        unreadMessagesCount={unreadMessagesCount}
        onNavigate={(screen) => {
          setIsMenuOpen(false);
          navigation.navigate(screen as never);
        }}
        onLogout={handleLogout}
      />

      <Modal
        visible={driverModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeDriverModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{driverModal.title}</Text>
            <Text style={styles.modalText}>{driverModal.message}</Text>
            <TouchableOpacity
              style={[
                styles.modalPrimaryButton,
                driverModal.primaryVariant === 'danger' && styles.modalPrimaryButtonDanger,
              ]}
              onPress={() => {
                const action = driverModal.onPrimary;
                closeDriverModal();
                if (action) {
                  void action();
                }
              }}
            >
              <Text
                style={[
                  styles.modalPrimaryButtonText,
                  driverModal.primaryVariant === 'danger' && styles.modalPrimaryButtonTextDanger,
                ]}
              >
                {driverModal.primaryLabel}
              </Text>
            </TouchableOpacity>
            {driverModal.secondaryLabel ? (
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={() => {
                  const action = driverModal.onSecondary;
                  closeDriverModal();
                  if (action) {
                    void action();
                  }
                }}
              >
                <Text style={styles.modalSecondaryButtonText}>{driverModal.secondaryLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>
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
    elevation: 20,
  },
  burgerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  burgerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
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
    elevation: 20,
  },
  toggleText: { color: '#F4F4F5', fontSize: 14, fontWeight: '600', marginRight: 10 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9,9,11,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#111113',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 20,
  },
  modalTitle: {
    color: '#F4F4F5',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },
  modalText: {
    color: '#D4D4D8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalPrimaryButton: {
    backgroundColor: '#F4F4F5',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalPrimaryButtonText: {
    color: '#09090B',
    fontSize: 15,
    fontWeight: '900',
  },
  modalPrimaryButtonDanger: {
    backgroundColor: '#7F1D1D',
  },
  modalPrimaryButtonTextDanger: {
    color: '#FECACA',
  },
  modalSecondaryButton: {
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSecondaryButtonText: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
  },
  recenterBtn: {
    position: 'absolute',
    bottom: 262,
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
    elevation: 20,
  },
  modeSwitcher: {
    position: 'absolute',
    top: 108,
    right: 20,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  intercityHubBtn: {
    position: 'absolute',
    top: 108,
    left: 20,
    backgroundColor: '#18181B',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#0EA5E9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 10,
    elevation: 22,
  },
  intercityHubBtnActive: {
    backgroundColor: '#082F49',
  },
  intercityHubText: {
    color: '#BAE6FD',
    fontSize: 13,
    fontWeight: '900',
  },
  intercityHubTextActive: {
    color: '#E0F2FE',
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
  intercityHero: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  intercityHeroTitle: {
    color: '#F4F4F5',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    marginBottom: 8,
  },
  intercityHeroText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
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
  courierModeTabs: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 6,
    gap: 6,
    marginBottom: 14,
  },
  courierModeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
  },
  courierModeTabActive: {
    backgroundColor: '#27272A',
  },
  courierModeTabActiveCourier: {
    backgroundColor: '#3F2B05',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  courierModeTabText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '800',
  },
  courierModeTabTextActive: {
    color: '#F4F4F5',
  },
  iconText: { fontSize: 24, color: '#fff' },
  iconDark: { fontSize: 22 },
});
