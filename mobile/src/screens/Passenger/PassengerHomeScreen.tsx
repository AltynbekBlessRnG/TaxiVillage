import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, logout } from '../../api/client';
import { loadAuth } from '../../storage/authStorage';
import {
  initializeNotifications,
  NOTIFICATION_TYPES,
  sendLocalNotification,
} from '../../utils/notifications';
import { SearchSheet } from '../../components/Passenger/SearchSheet';
import { ConfirmationSheet } from '../../components/Passenger/ConfirmationSheet';
import { SearchingSheet } from '../../components/Passenger/SearchingSheet';
import { OrderDetailsSheet } from '../../components/Passenger/OrderDetailsSheet';
import { createRidesSocket } from '../../api/socket';
import { buildRegion, buildRouteCoordinates, toMapPoint } from '../../utils/map';
import { geocodeAddressWithGoogle, reverseGeocodeWithGoogle } from '../../utils/googleMaps';
import { darkMinimalMapStyle } from '../../utils/mapStyle';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { resolveRideRoute } from '../../utils/rideRoute';

const { width, height } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'PassengerHome'>;
type ScreenState = 'IDLE' | 'SEARCH' | 'MAP_PICK' | 'ORDER_SETUP' | 'SEARCHING';
type SocketState = 'connected' | 'reconnecting' | 'disconnected';
type SearchMode = 'route' | 'stop';

interface RideSocketPayload {
  id: string;
  status: string;
}

const ACTIVE_RIDE_STATUSES = [
  'SEARCHING_DRIVER',
  'DRIVER_ASSIGNED',
  'ON_THE_WAY',
  'DRIVER_ARRIVED',
  'IN_PROGRESS',
] as const;

const hasValidCoordinates = (coords?: { lat: number; lng: number } | null) =>
  !!coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng) && !(coords.lat === 0 && coords.lng === 0);

export const PassengerHomeScreen: React.FC<Props> = ({ navigation, route }) => {
  const [screenState, setScreenState] = useState<ScreenState>('IDLE');
  const [activeService, setActiveService] = useState('Такси');
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<{ fullName?: string; phone?: string } | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
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
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapPickTarget, setMapPickTarget] = useState<'from' | 'to' | 'stop'>('to');
  const [searchMode, setSearchMode] = useState<SearchMode>('route');
  const [socketState, setSocketState] = useState<SocketState>('disconnected');
  const [displayRoute, setDisplayRoute] = useState<Array<{ latitude: number; longitude: number }>>([]);

  const searchSheetAnim = useRef(new Animated.Value(height)).current;
  const orderSheetTranslateY = useRef(new Animated.Value(height)).current;
  const sideMenuAnim = useRef(new Animated.Value(-width)).current;
  const menuBackdropOpacity = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<MapView>(null);

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

  const refreshActiveRide = useCallback(async () => {
    try {
      const res = await apiClient.get('/rides/my');
      const active = res.data.find((ride: any) => ACTIVE_RIDE_STATUSES.includes(ride.status));
      setActiveRideId(active?.id ?? null);
      setCurrentRideId((prev) => {
        if (!prev) {
          return active?.id ?? null;
        }

        return active?.id === prev ? prev : active?.id ?? null;
      });
      return active ?? null;
    } catch (error) {
      console.log(error);
      setActiveRideId(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshActiveRide().catch(() => {});
    const unsubscribe = navigation.addListener('focus', () => {
      refreshActiveRide().catch(() => {});
    });
    return unsubscribe;
  }, [navigation, refreshActiveRide]);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await apiClient.get('/users/me');
        setUserProfile({
          fullName: res.data.passenger?.fullName,
          phone: res.data.phone,
        });
      } catch {
        // Ignore profile bootstrap errors on home screen.
        setUserProfile({ fullName: 'Пользователь', phone: '' });
      } finally {
        setProfileReady(true);
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      setUserLocation(coords);
      setFromCoord(coords);
      setMapCenter(coords);
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
    };

    init().catch(() => {});
  }, []);

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
  }, [fromCoord?.lat, fromCoord?.lng, navigation, route.params?.selectedAddress, userLocation?.lat, userLocation?.lng]);

  useEffect(() => {
    let socket: ReturnType<typeof createRidesSocket> | null = null;
    let mounted = true;

    const connectSocket = async () => {
      const auth = await loadAuth();
      if (!mounted || !auth?.accessToken) {
        return;
      }

      socket = createRidesSocket(auth.accessToken);

      socket.on('connect', () => {
        if (mounted) {
          setSocketState('connected');
        }
      });
      socket.on('disconnect', () => {
        if (mounted) {
          setSocketState('disconnected');
        }
      });
      socket.io.on('reconnect_attempt', () => {
        if (mounted) {
          setSocketState('reconnecting');
        }
      });
      socket.io.on('reconnect', () => {
        if (mounted) {
          setSocketState('connected');
        }
      });
      socket.on('connect_error', () => {
        if (mounted) {
          setSocketState('reconnecting');
        }
      });

      socket.on('ride:updated', async (updatedRide: RideSocketPayload) => {
        if (!mounted) {
          return;
        }

        if (updatedRide.id === currentRideId || updatedRide.id === activeRideId) {
          if (updatedRide.status === 'DRIVER_ASSIGNED' || updatedRide.status === 'ON_THE_WAY') {
            setCurrentRideId(updatedRide.id);
            setActiveRideId(updatedRide.id);
            navigation.navigate('RideStatus', { rideId: updatedRide.id });
            return;
          }

          if (updatedRide.status === 'DRIVER_ARRIVED') {
            await sendLocalNotification('Водитель приехал', 'Водитель ожидает вас у точки подачи', {
              type: NOTIFICATION_TYPES.DRIVER_ARRIVED,
              rideId: updatedRide.id,
            });
          }

          if (updatedRide.status === 'CANCELED') {
            await sendLocalNotification('Поездка отменена', 'Водитель не найден, попробуйте еще раз', {
              type: 'RIDE_CANCELED',
              rideId: updatedRide.id,
            });
            Alert.alert('Упс', 'Водитель не найден, попробуйте еще раз');
            setCurrentRideId(null);
            setActiveRideId(null);
            setShowOrderDetails(false);
            await refreshActiveRide();
            changeState('IDLE');
          }
        }
      });
    };

    connectSocket().catch(() => {});

    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, [activeRideId, currentRideId, navigation, refreshActiveRide]);

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

  const updateAddress = async (lat: number, lng: number, field: 'from' | 'to') => {
    try {
      const formatted = await reverseGeocodeWithGoogle(lat, lng);

      if (field === 'from') {
        setFromAddress(formatted);
        setFromCoord({ lat, lng });
      } else {
        setToAddress(formatted);
        setToCoord({ lat, lng });
      }
    } catch (error) {
      console.log(error);
    }
  };

  const changeState = (newState: ScreenState) => {
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
    const rideIdToCancel = currentRideId ?? activeRideId;
    if (!rideIdToCancel) {
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
    ...(displayRoute.length > 0 ? displayRoute : routeCoordinates),
    ...nearbyDrivers.map((driver) => ({ latitude: driver.lat, longitude: driver.lng })),
    ...(userLocation ? [{ latitude: userLocation.lat, longitude: userLocation.lng }] : []),
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

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={initialRegion}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          mapType="standard"
          customMapStyle={darkMinimalMapStyle}
          showsUserLocation={false}
          onRegionChangeComplete={(region) => {
            if (screenState === 'MAP_PICK') {
              setMapCenter({ lat: region.latitude, lng: region.longitude });
            }
          }}
        >
          {userLocation && (
            <Marker
              identifier="user"
              coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }}
              title="Вы"
              pinColor="#2563EB"
            />
          )}

          {nearbyDrivers.map((driver) => (
            <Marker
              key={driver.id}
              coordinate={{ latitude: driver.lat, longitude: driver.lng }}
              title={driver.fullName}
              pinColor="#EF4444"
            />
          ))}

          {(displayRoute.length > 0 ? displayRoute : routeCoordinates).length >= 2 && (
            <Polyline
              coordinates={displayRoute.length > 0 ? displayRoute : routeCoordinates}
              strokeColor="#3B82F6"
              strokeWidth={4}
              lineDashPattern={screenState === 'SEARCHING' ? [8, 6] : undefined}
            />
          )}
        </MapView>

        {screenState === 'MAP_PICK' && (
          <View style={styles.centerPinContainer} pointerEvents="none">
            <View style={styles.ashenPin} />
          </View>
        )}
      </View>

      <ConnectionBanner visible={socketState !== 'connected'} />

      <TouchableOpacity style={styles.burgerBtn} onPress={() => toggleMenu(true)}>
        <Text style={{ fontSize: 22, color: '#fff' }}>☰</Text>
      </TouchableOpacity>

      {screenState === 'IDLE' && (
        <View style={styles.uiOverlay} pointerEvents="box-none">
          <View style={styles.ashenSearchCard}>
            <TouchableOpacity style={styles.ashenRow} onPress={() => changeState('SEARCH')}>
              <View style={styles.dotBlue} />
              <Text style={styles.ashenInputText} numberOfLines={1}>
                {fromAddress}
              </Text>
            </TouchableOpacity>
            <View style={styles.zincDivider} />
            <TouchableOpacity style={styles.ashenRow} onPress={() => changeState('SEARCH')}>
              <View style={styles.squareRed} />
              <Text style={toAddress ? styles.ashenInputText : styles.placeholderZinc}>
                {toAddress || 'Куда едем?'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.recenterBtn} onPress={recenterMap}>
            <Text style={{ fontSize: 22 }}>🎯</Text>
          </TouchableOpacity>

          {activeRideId && (
            <TouchableOpacity
              style={styles.activeRideBanner}
              onPress={() => navigation.navigate('RideStatus', { rideId: activeRideId })}
            >
              <View style={styles.dotGreen} />
              <Text style={styles.activeRideText}>У вас есть активная поездка!</Text>
              <Text style={styles.activeRideArrow}>›</Text>
            </TouchableOpacity>
          )}

          <View style={styles.bottomAshenBar}>
            {['Такси', 'Курьер', 'Еда', 'Межгород'].map((service) => (
              <TouchableOpacity
                key={service}
                style={[styles.serviceBtn, activeService === service && styles.serviceBtnActive]}
                onPress={() => {
                  setActiveService(service);
                  if (service === 'Курьер') {
                    navigation.navigate('CourierHome');
                  } else if (service === 'Еда') {
                    navigation.navigate('FoodHome');
                  } else if (service === 'Межгород') {
                    navigation.navigate('IntercityHome');
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
          changeState(toAddress ? 'ORDER_SETUP' : 'IDLE');
        }}
        onMapPick={(field) => {
          setMapPickTarget(field);
          setMapCenter(field === 'from' ? (fromCoord ?? userLocation) : (toCoord ?? userLocation));
          changeState('MAP_PICK');
        }}
        onSubmit={handleGeocodeAndProceed}
        onAddressSelect={handleAddressSelect}
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
                  setIsStopSelectionMode(false);
                  setSearchMode('route');
                } else if (mapPickTarget === 'from') {
                  setFromAddress(addrStr);
                  setFromCoord({ lat: mapCenter.lat, lng: mapCenter.lng });
                } else {
                  setToAddress(addrStr);
                  setToCoord({ lat: mapCenter.lat, lng: mapCenter.lng });
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

      <ConfirmationSheet
        translateY={orderSheetTranslateY}
        fromAddress={fromAddress}
        toAddress={toAddress}
        price={offeredPrice}
        setPrice={setOfferedPrice}
        onOrder={handleCreateRide}
        onEditAddress={() => changeState('SEARCH')}
        onSwipeDown={() => changeState('IDLE')}
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
      />

      {screenState === 'SEARCHING' && (
        <SearchingSheet
          onCancel={() => {
            void handleCancelSearchingRide();
          }}
          onShowDetails={() => setShowOrderDetails(true)}
        />
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
  mapContainer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
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
  centerPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -11,
    zIndex: 5,
  },
  ashenPin: {
    width: 22,
    height: 22,
    backgroundColor: '#fff',
    borderRadius: 11,
    borderBottomLeftRadius: 0,
    transform: [{ rotate: '45deg' }],
    borderWidth: 4,
    borderColor: '#000',
  },
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
  drawerText: { color: '#E4E4E7', fontSize: 17, fontWeight: '500' },
  dotBlue: { width: 8, height: 8, backgroundColor: '#3B82F6', borderRadius: 4, marginRight: 15 },
  squareRed: { width: 8, height: 8, backgroundColor: '#EF4444', marginRight: 15 },
});
