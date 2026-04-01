import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, logout } from '../../api/client';
import { initializeNotifications } from '../../utils/notifications';
import { SearchSheet } from '../../components/Passenger/SearchSheet';
import { ConfirmationSheet } from '../../components/Passenger/ConfirmationSheet';
import { SearchingSheet } from '../../components/Passenger/SearchingSheet';
import { ActiveOrderSheet } from '../../components/Passenger/ActiveOrderSheet';
import { OrderDetailsSheet } from '../../components/Passenger/OrderDetailsSheet';
import { buildRegion, buildRouteCoordinates, toMapPoint } from '../../utils/map';
import { geocodeAddressWithGoogle, reverseGeocodeWithGoogle } from '../../utils/googleMaps';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { resolveRideRoute } from '../../utils/rideRoute';
import { saveRecentAddress } from '../../storage/recentAddresses';
import { PassengerMapScene } from './home/PassengerMapScene';
import { usePassengerLocation } from './home/usePassengerLocation';
import { usePassengerRideState } from './home/usePassengerRideState';
import { usePassengerCourierState } from './home/usePassengerCourierState';
import { useNotificationsInbox } from '../../hooks/useNotificationsInbox';
import { useMessagesSummary } from '../../hooks/useMessagesSummary';
import { useThreadUnread } from '../../hooks/useThreadUnread';

const { width, height } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'PassengerHome'>;
type ScreenState = 'IDLE' | 'SEARCH' | 'MAP_PICK' | 'ORDER_SETUP' | 'SEARCHING';
type SearchMode = 'route' | 'stop';

const hasValidCoordinates = (coords?: { lat: number; lng: number } | null) =>
  !!coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng) && !(coords.lat === 0 && coords.lng === 0);

export const PassengerHomeScreen: React.FC<Props> = ({ navigation, route }) => {
  const isFocused = useIsFocused();
  const [screenState, setScreenState] = useState<ScreenState>('IDLE');
  const [activeService, setActiveService] = useState<'Такси' | 'Курьер' | 'Еда' | 'Межгород'>('Такси');
  const [loading, setLoading] = useState(false);
  const [fromAddress, setFromAddress] = useState('Определяем адрес...');
  const [toAddress, setToAddress] = useState('');
  const [fromCoord, setFromCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [toCoord, setToCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [offeredPrice, setOfferedPrice] = useState('');
  const [comment, setComment] = useState('');
  const [stops, setStops] = useState<Array<{ address: string; lat: number; lng: number }>>([]);
  const [isStopSelectionMode, setIsStopSelectionMode] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<Array<{ id: string; lat: number; lng: number; fullName: string }>>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mapPickTarget, setMapPickTarget] = useState<'from' | 'to' | 'stop'>('to');
  const [searchMode, setSearchMode] = useState<SearchMode>('route');
  const [searchInitialField, setSearchInitialField] = useState<'from' | 'to'>('to');
  const [displayRoute, setDisplayRoute] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [courierItemDescription, setCourierItemDescription] = useState('');
  const [courierPackageWeight, setCourierPackageWeight] = useState('');
  const [courierPackageSize, setCourierPackageSize] = useState('');
  const { unreadCount: unreadNotificationsCount } = useNotificationsInbox();
  const { unreadCount: unreadMessagesCount, refresh: refreshMessagesSummary } = useMessagesSummary({ autoRefresh: false });
  const { rideUnreadById, refresh: refreshThreadUnread } = useThreadUnread({ autoRefresh: false });

  const searchSheetAnim = useRef(new Animated.Value(height)).current;
  const orderSheetTranslateY = useRef(new Animated.Value(height)).current;
  const sideMenuAnim = useRef(new Animated.Value(-width)).current;
  const menuBackdropOpacity = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<MapView>(null);

  const updateAddress = useCallback(async (lat: number, lng: number, field: 'from' | 'to') => {
    try {
      const formatted = await reverseGeocodeWithGoogle(lat, lng);

      if (field === 'from') {
        setFromAddress(formatted);
        setFromCoord({ lat, lng });
      } else {
        setToAddress(formatted);
        setToCoord({ lat, lng });
      }

      await saveRecentAddress(formatted, lat, lng);
    } catch (error) {
      console.log(error);
    }
  }, []);

  const changeState = useCallback((newState: ScreenState) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    Animated.timing(searchSheetAnim, {
      toValue: newState === 'SEARCH' ? height * 0.1 : height,
      duration: 300,
      useNativeDriver: true,
    }).start();

    if (newState === 'ORDER_SETUP') {
      orderSheetTranslateY.setValue(height);
      Animated.spring(orderSheetTranslateY, {
        toValue: 0,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(orderSheetTranslateY, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }

    setScreenState(newState);
    Keyboard.dismiss();
  }, [orderSheetTranslateY, searchSheetAnim]);

  const {
    userProfile,
    profileReady,
    userLocation,
    mapCenter,
    setMapCenter,
  } = usePassengerLocation({
    onResolvedCurrentLocation: async (coords) => {
      setFromCoord(coords);
      await updateAddress(coords.lat, coords.lng, 'from');
      mapRef.current?.animateToRegion(
        {
          latitude: coords.lat,
          longitude: coords.lng,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        300,
      );
    },
  });

  const handleRideReturnedToIdle = useCallback(() => {
    setShowOrderDetails(false);
    changeState('IDLE');
  }, [changeState]);

  const handleCourierReturnedToIdle = useCallback(() => {
    setShowOrderDetails(false);
    changeState('IDLE');
  }, [changeState]);

  const {
    currentRideId,
    setCurrentRideId,
    activeRideId,
    setActiveRideId,
    activeRide,
    setActiveRide,
    driverLocation,
    activeRideRoute,
    etaSeconds,
    socketState,
    incomingChatToast,
    setIncomingChatToast,
    refreshActiveRide,
  } = usePassengerRideState({
    onBecameActive: () => changeState('SEARCHING'),
    onReturnedToIdle: handleRideReturnedToIdle,
  });

  const {
    activeCourierOrderId,
    setActiveCourierOrderId,
    activeCourierOrder,
    setActiveCourierOrder,
    courierLocation,
    activeCourierRoute,
    refreshActiveCourierOrder,
    clearCourierState,
  } = usePassengerCourierState({
    onBecameActive: () => changeState('SEARCHING'),
    onReturnedToIdle: handleCourierReturnedToIdle,
    onForceCourierMode: () => setActiveService('Курьер'),
  });

  const resetTaxiDraft = useCallback(() => {
    setToAddress('');
    setToCoord(null);
    setOfferedPrice('');
    setComment('');
    setStops([]);
    setDisplayRoute([]);
    setSearchMode('route');
    setIsStopSelectionMode(false);
    setMapPickTarget('to');
  }, []);

  const resetCourierDraft = useCallback(() => {
    setToAddress('');
    setToCoord(null);
    setOfferedPrice('');
    setComment('');
    setCourierItemDescription('');
    setCourierPackageWeight('');
    setCourierPackageSize('');
    setDisplayRoute([]);
    setSearchMode('route');
    setMapPickTarget('to');
  }, []);

  const routeCoordinates = useMemo(
    () =>
      buildRouteCoordinates({
        fromLat: fromCoord?.lat,
        fromLng: fromCoord?.lng,
        stops,
        toLat: toCoord?.lat,
        toLng: toCoord?.lng,
      }),
    [fromCoord, stops, toCoord],
  );

  useEffect(() => {
    if (!hasValidCoordinates(fromCoord) || !hasValidCoordinates(toCoord)) {
      setDisplayRoute(routeCoordinates);
      return;
    }

    const timeoutId = setTimeout(() => {
      resolveRideRoute({
        status: 'SEARCHING_DRIVER',
        fromCoord,
        toCoord,
        stops,
      })
        .then((result) => setDisplayRoute(result.coordinates.length > 0 ? result.coordinates : routeCoordinates))
        .catch(() => setDisplayRoute(routeCoordinates));
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [fromCoord, routeCoordinates, stops, toCoord]);

  useEffect(() => {
    initializeNotifications().catch(() => {});
  }, []);

  useEffect(() => {
    if (!incomingChatToast) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setIncomingChatToast(null);
    }, 4000);

    return () => clearTimeout(timeoutId);
  }, [incomingChatToast, setIncomingChatToast]);

  useEffect(() => {
    Promise.all([refreshActiveRide(), refreshActiveCourierOrder()])
      .then(([activeRideItem, activeCourierItem]) => {
        const hasPendingSearch =
          !!currentRideId || !!activeRideId || !!activeCourierOrderId;

        if (!activeRideItem && !activeCourierItem && !hasPendingSearch) {
          setShowOrderDetails(false);
          if (screenState === 'SEARCHING') {
            setScreenState('IDLE');
          }
        }
      })
      .catch(() => {});

    const unsubscribe = navigation.addListener('focus', () => {
      Promise.all([refreshActiveRide(), refreshActiveCourierOrder()])
        .then(([activeRideItem, activeCourierItem]) => {
          const hasPendingSearch =
            !!currentRideId || !!activeRideId || !!activeCourierOrderId;

          if (!activeRideItem && !activeCourierItem && !hasPendingSearch) {
            setShowOrderDetails(false);
            if (screenState === 'SEARCHING') {
              setScreenState('IDLE');
            }
          }
        })
        .catch(() => {});
      Promise.allSettled([
        refreshMessagesSummary(),
        refreshThreadUnread(),
      ]);
    });

    return unsubscribe;
  }, [
    activeCourierOrderId,
    activeRideId,
    currentRideId,
    navigation,
    refreshActiveCourierOrder,
    refreshActiveRide,
    refreshMessagesSummary,
    refreshThreadUnread,
    screenState,
  ]);

  useEffect(() => {
    if (screenState === 'IDLE' && userLocation) {
      fetchNearbyDrivers();
    }
  }, [screenState, userLocation]);

  useEffect(() => {
    const selectedAddress = route.params?.selectedAddress;
    if (!selectedAddress || !hasValidCoordinates(selectedAddress)) {
      return;
    }

    setToAddress(selectedAddress.address);
    setToCoord({ lat: selectedAddress.lat, lng: selectedAddress.lng });
    setSearchMode('route');
    setIsStopSelectionMode(false);
    changeState('ORDER_SETUP');

    const latitude = fromCoord?.lat ?? userLocation?.lat ?? selectedAddress.lat;
    const longitude = fromCoord?.lng ?? userLocation?.lng ?? selectedAddress.lng;
    mapRef.current?.animateToRegion(
      buildRegion(
        [
          { latitude, longitude },
          { latitude: selectedAddress.lat, longitude: selectedAddress.lng },
        ],
        { latitude: selectedAddress.lat, longitude: selectedAddress.lng },
      ),
      350,
    );

    navigation.setParams({ selectedAddress: undefined });
  }, [changeState, fromCoord?.lat, fromCoord?.lng, navigation, route.params?.selectedAddress, userLocation?.lat, userLocation?.lng]);

  const fetchNearbyDrivers = async () => {
    if (!userLocation) {
      return;
    }

    try {
      const res = await apiClient.get('/drivers/nearby', {
        params: { lat: userLocation.lat, lng: userLocation.lng, radius: 5 },
      });
      setNearbyDrivers(res.data || []);
    } catch (error) {
      console.log('Failed to fetch nearby drivers:', error);
    }
  };

  const handleGeocodeAndProceed = async () => {
    if (!toAddress) {
      Alert.alert('Ошибка', 'Введите адрес назначения');
      return;
    }

    if (fromCoord && toCoord) {
      changeState('ORDER_SETUP');
      return;
    }

    setLoading(true);
    try {
      const [f, t] = await Promise.all([
        hasValidCoordinates(fromCoord)
          ? Promise.resolve(null)
          : geocodeAddressWithGoogle(fromAddress, userLocation).catch(() => null),
        hasValidCoordinates(toCoord)
          ? Promise.resolve(null)
          : geocodeAddressWithGoogle(toAddress, userLocation).catch(() => null),
      ]);

      if (f) {
        setFromAddress(f.address);
        setFromCoord({ lat: f.lat, lng: f.lng });
      }
      if (t) {
        setToAddress(t.address);
        setToCoord({ lat: t.lat, lng: t.lng });
      }
      changeState('ORDER_SETUP');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRide = async () => {
    if (activeService === 'Курьер') {
      if (!courierItemDescription.trim()) {
        Alert.alert('Не хватает данных', 'Опишите, что нужно доставить.');
        return;
      }

      if (!hasValidCoordinates(fromCoord) || !hasValidCoordinates(toCoord)) {
        Alert.alert('Нужны координаты', 'Выберите адреса забора и доставки из подсказок или на карте.');
        return;
      }

      setLoading(true);
      try {
        const res = await apiClient.post('/courier-orders', {
          pickupAddress: fromAddress,
          pickupLat: fromCoord!.lat,
          pickupLng: fromCoord!.lng,
          dropoffAddress: toAddress,
          dropoffLat: toCoord!.lat,
          dropoffLng: toCoord!.lng,
          itemDescription: courierItemDescription.trim(),
          packageWeight: courierPackageWeight.trim() || undefined,
          packageSize: courierPackageSize.trim() || undefined,
          comment: comment.trim() || undefined,
          estimatedPrice: parseFloat(offeredPrice) || undefined,
        });

        setActiveCourierOrderId(res.data?.id ?? null);
        setActiveCourierOrder(res.data ?? null);
        changeState('SEARCHING');
      } catch (e: any) {
        const serverMessage = e.response?.data?.message;
        const errorMessage = Array.isArray(serverMessage) ? serverMessage.join(', ') : serverMessage;
        Alert.alert('Ошибка сервера', errorMessage || 'Не удалось создать заказ доставки');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!toAddress) {
      Alert.alert('Ошибка', 'Укажите адрес назначения');
      return;
    }

    if (!hasValidCoordinates(fromCoord) || !hasValidCoordinates(toCoord)) {
      Alert.alert('Нужны координаты', 'Выберите адрес из подсказок Google или укажите точку на карте.');
      return;
    }

    if (stops.some((stop) => !hasValidCoordinates(stop))) {
      Alert.alert('Нужны координаты', 'Один из заездов не содержит корректную точку. Выберите его заново.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        fromAddress,
        toAddress,
        fromLat: fromCoord!.lat,
        fromLng: fromCoord!.lng,
        toLat: toCoord!.lat,
        toLng: toCoord!.lng,
        comment,
        stops: stops.map((stop) => ({
          address: stop.address,
          lat: stop.lat,
          lng: stop.lng,
        })),
        estimatedPrice: parseFloat(offeredPrice) || 0,
      };

      const res = await apiClient.post('/rides', payload);
      if (res.data?.id) {
        setCurrentRideId(res.data.id);
        setActiveRideId(res.data.id);
        changeState('SEARCHING');
      }
    } catch (e: any) {
      const serverMessage = e.response?.data?.message;
      const errorMessage = Array.isArray(serverMessage)
        ? serverMessage.join(', ')
        : serverMessage;
      Alert.alert('Ошибка сервера', errorMessage || 'Не удалось создать заказ');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSearchingRide = async () => {
    if (activeService === 'Курьер' && activeCourierOrderId) {
      Alert.alert('Отменить доставку?', 'Мы прекратим поиск курьера для этого заказа.', [
        { text: 'Нет', style: 'cancel' },
        {
          text: 'Да',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await apiClient.post(`/courier-orders/${activeCourierOrderId}/cancel`);
              clearCourierState();
              resetCourierDraft();
              changeState('IDLE');
            } catch (e: any) {
              const message = e.response?.data?.message || 'Не удалось отменить заказ';
              Alert.alert('Ошибка', message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]);
      return;
    }

    const rideIdToCancel = currentRideId ?? activeRideId;
    if (!rideIdToCancel) {
      resetTaxiDraft();
      changeState('IDLE');
      return;
    }

    Alert.alert('Отменить поездку?', 'Мы прекратим поиск водителя для этого заказа.', [
      { text: 'Нет', style: 'cancel' },
      {
        text: 'Да',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await apiClient.post(`/rides/${rideIdToCancel}/cancel`);
            setCurrentRideId(null);
            setActiveRideId(null);
            setShowOrderDetails(false);
            await refreshActiveRide();
            resetTaxiDraft();
            changeState('IDLE');
          } catch (e: any) {
            const message = e.response?.data?.message || 'Не удалось отменить заказ';
            Alert.alert('Ошибка', message);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleAddressSelect = (field: 'from' | 'to', address: string, lat: number, lng: number) => {
    if (field === 'from') {
      setFromAddress(address);
      setFromCoord(hasValidCoordinates({ lat, lng }) ? { lat, lng } : null);
      return;
    }

    if (searchMode === 'stop') {
      if (!hasValidCoordinates({ lat, lng })) {
        Alert.alert('Нужны координаты', 'Выберите адрес из подсказок Google или укажите точку на карте.');
        return;
      }
      setStops((current) => [...current, { address, lat, lng }]);
      setSearchMode('route');
      changeState('ORDER_SETUP');
      return;
    }

    setToAddress(address);
    setToCoord(hasValidCoordinates({ lat, lng }) ? { lat, lng } : null);
  };

  const openSearchSheet = useCallback(
    (field: 'from' | 'to') => {
      setSearchInitialField(field);
      setSearchMode('route');
      setIsStopSelectionMode(false);
      changeState('SEARCH');
    },
    [changeState],
  );

  const toggleMenu = (show: boolean) => {
    if (show) {
      setIsMenuOpen(true);
    }
    Animated.parallel([
      Animated.timing(sideMenuAnim, {
        toValue: show ? 0 : -width,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(menuBackdropOpacity, {
        toValue: show ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (!show) {
        setIsMenuOpen(false);
      }
    });
  };

  const recenterMap = () => {
    if (!userLocation) {
      return;
    }

    mapRef.current?.animateToRegion(
      {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      },
      300,
    );
  };

  const mapPoints = [
    ...(activeRide
      ? activeRideRoute
      : activeCourierOrder
      ? activeCourierRoute
      : displayRoute.length > 0
      ? displayRoute
      : routeCoordinates),
    ...nearbyDrivers.map((driver) => ({ latitude: driver.lat, longitude: driver.lng })),
    ...(userLocation ? [{ latitude: userLocation.lat, longitude: userLocation.lng }] : []),
    ...(driverLocation ? [{ latitude: driverLocation.lat, longitude: driverLocation.lng }] : []),
    ...(courierLocation ? [{ latitude: courierLocation.lat, longitude: courierLocation.lng }] : []),
  ];

  const initialRegion = buildRegion(
    mapPoints,
    toMapPoint(userLocation?.lat, userLocation?.lng) ?? {
      latitude: 43.2389,
      longitude: 76.8897,
    },
  );

  if (!profileReady || !userProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F4F4F5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

        <PassengerMapScene
          mapRef={mapRef}
          initialRegion={initialRegion}
          screenState={screenState}
          activeService={activeService}
        userLocation={userLocation}
        nearbyDrivers={nearbyDrivers}
        activeRide={activeRide}
        driverLocation={driverLocation}
        activeCourierOrder={activeCourierOrder}
        courierLocation={courierLocation}
        routeCoordinates={
          activeRide
            ? activeRideRoute
            : activeCourierOrder
            ? activeCourierRoute
            : displayRoute.length > 0
            ? displayRoute
            : routeCoordinates
        }
          onRegionChangeComplete={(region) => {
            if (screenState === 'MAP_PICK') {
              setMapCenter({ lat: region.latitude, lng: region.longitude });
            }
          }}
          showMapPickPin={screenState === 'MAP_PICK'}
          showSearchingRadar={
            screenState === 'SEARCHING' &&
            !activeRide &&
            !activeCourierOrder &&
            !!userLocation &&
            activeService !== 'Еда' &&
            activeService !== 'Межгород'
          }
        />

      <ConnectionBanner visible={socketState !== 'connected'} />

      {isFocused && incomingChatToast ? (
        <TouchableOpacity
          style={styles.chatToast}
          activeOpacity={0.9}
          onPress={() => {
            setIncomingChatToast(null);
            if (activeRide?.id) {
              navigation.navigate('ChatScreen', { rideId: activeRide.id });
            }
          }}
        >
          <Text style={styles.chatToastTitle}>Водитель написал</Text>
          <Text style={styles.chatToastBody} numberOfLines={2}>
            {incomingChatToast.text}
          </Text>
        </TouchableOpacity>
      ) : null}

        <TouchableOpacity style={styles.burgerBtn} onPress={() => toggleMenu(true)}>
        <Text style={{ fontSize: 22, color: '#fff' }}>☰</Text>
        {unreadNotificationsCount > 0 ? (
          <View style={styles.burgerBadge}>
            <Text style={styles.burgerBadgeText}>
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {screenState === 'IDLE' && (
        <View style={styles.uiOverlay} pointerEvents="box-none">
          <View style={styles.ashenSearchCard}>
            <TouchableOpacity style={styles.ashenRow} onPress={() => openSearchSheet('from')}>
              <View style={styles.dotBlue} />
              <Text style={styles.ashenInputText} numberOfLines={1}>
                {fromAddress}
              </Text>
            </TouchableOpacity>
            <View style={styles.zincDivider} />
            <TouchableOpacity style={styles.ashenRow} onPress={() => openSearchSheet('to')}>
              <View style={styles.squareRed} />
              <Text style={toAddress ? styles.ashenInputText : styles.placeholderZinc}>
                {toAddress || (activeService === 'Курьер' ? 'Куда доставить?' : 'Куда едем?')}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.recenterBtn} onPress={recenterMap}>
            <Text style={{ fontSize: 22 }}>🎯</Text>
          </TouchableOpacity>

          {activeRideId && !activeRide && (
            <TouchableOpacity
              style={styles.activeRideBanner}
              onPress={() => changeState('SEARCHING')}
            >
              <View style={styles.dotGreen} />
              <Text style={styles.activeRideText}>У вас есть активная поездка!</Text>
              <Text style={styles.activeRideArrow}>›</Text>
            </TouchableOpacity>
          )}

          {!activeRideId && activeCourierOrderId ? (
            <TouchableOpacity
              style={[styles.activeRideBanner, styles.activeCourierBanner]}
              onPress={() => {
                setActiveService('Курьер');
                changeState('SEARCHING');
              }}
            >
              <View style={styles.dotGreen} />
              <Text style={styles.activeRideText}>У вас есть активная доставка!</Text>
              <Text style={styles.activeRideArrow}>›</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.bottomAshenBar}>
            {(['Такси', 'Курьер', 'Еда', 'Межгород'] as const).map((service) => (
              <TouchableOpacity
                key={service}
                style={[styles.serviceBtn, activeService === service && styles.serviceBtnActive]}
                onPress={() => {
                  setActiveService(service);
                  if (service === 'Курьер') {
                    resetTaxiDraft();
                  } else if (service === 'Еда') {
                    navigation.navigate('FoodHome');
                  } else if (service === 'Межгород') {
                    navigation.navigate('IntercityHome');
                  } else if (service === 'Такси') {
                    resetCourierDraft();
                  }
                }}
              >
                <Text style={{ fontSize: 20 }}>
                  {service === 'Такси'
                    ? '🚕'
                    : service === 'Курьер'
                    ? '📦'
                    : service === 'Еда'
                    ? '🍕'
                    : '🛣️'}
                </Text>
                <Text style={[styles.serviceLabel, activeService === service && { color: '#fff' }]}>
                  {service}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <SearchSheet
        anim={searchSheetAnim}
        visible={screenState === 'SEARCH'}
        initialField={searchInitialField}
        mode={searchMode}
        fromAddress={fromAddress}
        setFromAddress={setFromAddress}
        toAddress={toAddress}
        setToAddress={setToAddress}
        isStopSelectionMode={isStopSelectionMode}
        userLocation={userLocation}
        onClose={() => {
          setIsStopSelectionMode(false);
          setSearchMode('route');
          if (toAddress) {
            changeState('ORDER_SETUP');
          } else {
            if (activeService === 'Курьер') {
              resetCourierDraft();
            } else {
              resetTaxiDraft();
            }
            changeState('IDLE');
          }
        }}
        onMapPick={(field) => {
          setMapPickTarget(field);
          setMapCenter(field === 'from' ? (fromCoord ?? userLocation) : (toCoord ?? userLocation));
          changeState('MAP_PICK');
        }}
        onSubmit={handleGeocodeAndProceed}
        onAddressSelect={handleAddressSelect}
        fromPlaceholder={activeService === 'Курьер' ? 'Откуда забрать?' : 'Откуда?'}
        toPlaceholder={activeService === 'Курьер' ? 'Куда доставить?' : 'Куда?'}
        title={searchMode === 'stop' ? 'Добавить заезд' : activeService === 'Курьер' ? 'Доставка' : 'Маршрут'}
      />

      {screenState === 'MAP_PICK' && (
        <View style={styles.confirmMapPick}>
          <TouchableOpacity
            style={styles.zincMainBtn}
            onPress={async () => {
              if (mapCenter) {
                const addrStr = await reverseGeocodeWithGoogle(mapCenter.lat, mapCenter.lng).catch(
                  () => 'Точка на карте',
                );

                if (mapPickTarget === 'stop') {
                  setStops((current) => [
                    ...current,
                    { address: addrStr, lat: mapCenter.lat, lng: mapCenter.lng },
                  ]);
                  await saveRecentAddress(addrStr, mapCenter.lat, mapCenter.lng);
                  setIsStopSelectionMode(false);
                  setSearchMode('route');
                } else if (mapPickTarget === 'from') {
                  setFromAddress(addrStr);
                  setFromCoord({ lat: mapCenter.lat, lng: mapCenter.lng });
                  await saveRecentAddress(addrStr, mapCenter.lat, mapCenter.lng);
                } else {
                  setToAddress(addrStr);
                  setToCoord({ lat: mapCenter.lat, lng: mapCenter.lng });
                  await saveRecentAddress(addrStr, mapCenter.lat, mapCenter.lng);
                }
              }
              if (mapPickTarget === 'from' && !toAddress) {
                setSearchMode('route');
                changeState('SEARCH');
                return;
              }

              setSearchMode('route');
              changeState('ORDER_SETUP');
            }}
          >
            <Text style={styles.zincMainBtnText}>Готово</Text>
          </TouchableOpacity>
        </View>
      )}

      {screenState === 'ORDER_SETUP' ? (
        <ConfirmationSheet
          translateY={orderSheetTranslateY}
          serviceType={activeService === 'Курьер' ? 'courier' : 'taxi'}
          fromAddress={fromAddress}
          toAddress={toAddress}
          price={offeredPrice}
          setPrice={setOfferedPrice}
          onOrder={handleCreateRide}
          onEditAddress={() => changeState('SEARCH')}
          onSwipeDown={() => {
            if (activeService === 'Курьер') {
              resetCourierDraft();
            } else {
              resetTaxiDraft();
            }
            changeState('IDLE');
          }}
          loading={loading}
          comment={comment}
          setComment={setComment}
          stops={stops}
          onAddStop={() => {
            if (!toAddress || !toCoord) {
              Alert.alert('Сначала укажите адрес', 'Сначала выберите, куда едем, а потом добавляйте заезд.');
              return;
            }

            setIsStopSelectionMode(true);
            setSearchMode('stop');
            changeState('SEARCH');
          }}
          isAddStopDisabled={!hasValidCoordinates(toCoord)}
          onRemoveStop={(indexToRemove: number) =>
            setStops((current) => current.filter((_, index) => index !== indexToRemove))
          }
          itemDescription={courierItemDescription}
          setItemDescription={setCourierItemDescription}
          packageWeight={courierPackageWeight}
          setPackageWeight={setCourierPackageWeight}
          packageSize={courierPackageSize}
          setPackageSize={setCourierPackageSize}
        />
      ) : null}

      {screenState === 'SEARCHING' && (
        activeRide || activeCourierOrder ? (
          <ActiveOrderSheet
            activeRide={activeRide}
            activeCourierOrder={activeCourierOrder}
            etaSeconds={etaSeconds}
            rideUnreadCount={activeRide ? (rideUnreadById[activeRide.id] ?? 0) : 0}
            onCancel={() => {
              void handleCancelSearchingRide();
            }}
            onOpenRideChat={
              activeRide
                ? () => {
                    navigation.navigate('ChatScreen', { rideId: activeRide.id });
                  }
                : undefined
            }
          />
        ) : (
          <SearchingSheet
            onCancel={() => {
              void handleCancelSearchingRide();
            }}
            title={activeService === 'Курьер' ? 'Ищем курьера...' : 'Ищем машину...'}
            cancelLabel={activeService === 'Курьер' ? 'Отменить\nдоставку' : 'Отменить\nпоездку'}
            fromAddress={fromAddress}
            toAddress={toAddress}
            comment={comment}
            stops={stops}
            price={offeredPrice}
          />
        )
      )}

      <OrderDetailsSheet
        visible={showOrderDetails}
        onClose={() => setShowOrderDetails(false)}
        fromAddress={fromAddress}
        comment={comment}
        stops={stops}
        toAddress={toAddress}
        price={offeredPrice}
      />

      {isMenuOpen && (
        <Animated.View style={[styles.menuBackdrop, { opacity: menuBackdropOpacity }]}>
          <Pressable style={{ flex: 1 }} onPress={() => toggleMenu(false)} />
        </Animated.View>
      )}
      <Animated.View style={[styles.sideDrawer, { transform: [{ translateX: sideMenuAnim }] }]}>
        <View style={styles.drawerHeader}>
          <Text style={styles.drName}>{userProfile?.fullName || 'Загрузка...'}</Text>
          <Text style={styles.drPhone}>{userProfile?.phone || ''}</Text>
        </View>
        <ScrollView style={{ padding: 20 }}>
          <TouchableOpacity
            style={styles.drawerItem}
            onPress={() => {
              toggleMenu(false);
              navigation.navigate('Notifications');
            }}
          >
            <View style={styles.drawerItemRow}>
              <Text style={styles.drawerText}>Уведомления</Text>
              {unreadNotificationsCount > 0 ? (
                <View style={styles.drawerBadge}>
                  <Text style={styles.drawerBadgeText}>
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.drawerItem}
            onPress={() => {
              toggleMenu(false);
              navigation.navigate('Messages');
            }}
          >
            <View style={styles.drawerItemRow}>
              <Text style={styles.drawerText}>Сообщения</Text>
              {unreadMessagesCount > 0 ? (
                <View style={styles.drawerBadge}>
                  <Text style={styles.drawerBadgeText}>
                    {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.drawerItem}
            onPress={() => {
              toggleMenu(false);
              navigation.navigate('RideHistory');
            }}
          >
            <Text style={styles.drawerText}>История заказов</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.drawerItem}
            onPress={() => {
              toggleMenu(false);
              navigation.navigate('FavoriteAddresses');
            }}
          >
            <Text style={styles.drawerText}>Мои адреса</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.drawerItem, { marginTop: 20 }]}
            onPress={async () => {
              toggleMenu(false);
              await logout();
              navigation.replace('Login');
            }}
          >
            <Text style={[styles.drawerText, { color: '#EF4444' }]}>Выйти</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
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
  uiOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
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
    zIndex: 100,
  },
  chatToast: {
    position: 'absolute',
    top: 108,
    left: 16,
    right: 16,
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 16,
    paddingVertical: 14,
    zIndex: 120,
  },
  chatToastTitle: { color: '#F4F4F5', fontSize: 13, fontWeight: '800', marginBottom: 4 },
  chatToastBody: { color: '#D4D4D8', fontSize: 14, fontWeight: '500' },
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
  ashenSearchCard: {
    marginTop: 115,
    marginHorizontal: 16,
    backgroundColor: '#18181B',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    elevation: 15,
  },
  ashenRow: { flexDirection: 'row', alignItems: 'center', height: 44 },
  ashenInputText: { flex: 1, color: '#F4F4F5', fontSize: 16, fontWeight: '500' },
  placeholderZinc: { color: '#71717A', fontSize: 16 },
  zincDivider: { height: 1, backgroundColor: '#27272A', marginVertical: 4, marginLeft: 28 },
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
  },
  activeRideBanner: {
    position: 'absolute',
    bottom: 110,
    left: 20,
    right: 20,
    backgroundColor: '#10B981',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeCourierBanner: {
    backgroundColor: '#F59E0B',
  },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', marginRight: 12 },
  activeRideText: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  activeRideArrow: { color: '#fff', fontSize: 24, fontWeight: '300', marginTop: -4 },
  bottomAshenBar: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#18181B',
    borderRadius: 24,
    flexDirection: 'row',
    padding: 8,
    borderWidth: 1,
    borderColor: '#27272A',
    justifyContent: 'space-around',
  },
  serviceBtn: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 16 },
  serviceBtnActive: { backgroundColor: '#27272A' },
  serviceLabel: { color: '#71717A', fontSize: 12, fontWeight: '700', marginTop: 4 },
  confirmMapPick: { position: 'absolute', bottom: 50, left: 20, right: 20, zIndex: 100 },
  zincMainBtn: {
    backgroundColor: '#F4F4F5',
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zincMainBtnText: { color: '#000', fontSize: 18, fontWeight: '800' },
  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 900 },
  sideDrawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: width * 0.8,
    backgroundColor: '#09090B',
    zIndex: 1000,
    borderRightWidth: 1,
    borderColor: '#18181B',
  },
  drawerHeader: { backgroundColor: '#18181B', padding: 28, paddingTop: 65 },
  drName: { color: '#fff', fontSize: 22, fontWeight: '800' },
  drPhone: { color: '#71717A', fontSize: 15, marginTop: 6 },
  drawerItem: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#18181B' },
  drawerItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  drawerText: { color: '#E4E4E7', fontSize: 17, fontWeight: '500' },
  drawerBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  dotBlue: { width: 8, height: 8, backgroundColor: '#3B82F6', borderRadius: 4, marginRight: 15 },
  squareRed: { width: 8, height: 8, backgroundColor: '#EF4444', marginRight: 15 },
});
