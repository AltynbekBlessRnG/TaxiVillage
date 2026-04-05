import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Keyboard,
  LayoutAnimation,
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
import { buildRegion, buildRouteCoordinates, toMapPoint } from '../../utils/map';
import { reverseGeocodeWithGoogle } from '../../utils/googleMaps';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { resolveRideRoute } from '../../utils/rideRoute';
import { saveRecentAddress } from '../../storage/recentAddresses';
import { PassengerMapScene } from './home/PassengerMapScene';
import { PassengerIdleOverlay } from './home/PassengerIdleOverlay';
import { PassengerSheetHost } from './home/PassengerSheetHost';
import { PassengerSideDrawer } from './home/PassengerSideDrawer';
import { usePassengerHomeController } from './home/usePassengerHomeController';
import { usePassengerLocation } from './home/usePassengerLocation';
import { usePassengerRideState } from './home/usePassengerRideState';
import { usePassengerCourierState } from './home/usePassengerCourierState';
import {
  usePassengerFlowStore,
  type PassengerScreenState,
} from './home/usePassengerFlowStore';
import { useNotificationsInbox } from '../../hooks/useNotificationsInbox';
import { useMessagesSummary } from '../../hooks/useMessagesSummary';
import { useThreadUnread } from '../../hooks/useThreadUnread';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'PassengerHome'>;

const hasValidCoordinates = (coords?: { lat: number; lng: number } | null) =>
  !!coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng) && !(coords.lat === 0 && coords.lng === 0);

export const PassengerHomeScreen: React.FC<Props> = ({ navigation, route }) => {
  const isFocused = useIsFocused();
  const {
    screenState,
    setScreenState,
    activeService,
    setActiveService,
    fromAddress,
    setFromAddress,
    toAddress,
    setToAddress,
    fromCoord,
    setFromCoord,
    toCoord,
    setToCoord,
    fromLocationPrecision,
    setFromLocationPrecision,
    toLocationPrecision,
    setToLocationPrecision,
    offeredPrice,
    setOfferedPrice,
    comment,
    setComment,
    stops,
    setStops,
    isStopSelectionMode,
    setIsStopSelectionMode,
    showSearchingDetails,
    setShowSearchingDetails,
    mapPickTarget,
    setMapPickTarget,
    searchMode,
    setSearchMode,
    searchInitialField,
    setSearchInitialField,
    displayRoute,
    setDisplayRoute,
    courierItemDescription,
    setCourierItemDescription,
    courierPackageWeight,
    setCourierPackageWeight,
    courierPackageSize,
    setCourierPackageSize,
    resetTaxiDraft,
    resetCourierDraft,
  } = usePassengerFlowStore();
  const [loading, setLoading] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<Array<{ id: string; lat: number; lng: number; fullName: string }>>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { unreadCount: unreadNotificationsCount } = useNotificationsInbox();
  const { unreadCount: unreadMessagesCount, refresh: refreshMessagesSummary } = useMessagesSummary({ autoRefresh: false });
  const { rideUnreadById, refresh: refreshThreadUnread } = useThreadUnread({ autoRefresh: false });

  const sideMenuAnim = useRef(new Animated.Value(-width)).current;
  const menuBackdropOpacity = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<MapView>(null);

  const updateAddress = useCallback(async (lat: number, lng: number, field: 'from' | 'to') => {
    try {
      const formatted = await reverseGeocodeWithGoogle(lat, lng);

      if (field === 'from') {
        setFromAddress(formatted);
        setFromCoord({ lat, lng });
        setFromLocationPrecision('EXACT');
      } else {
        setToAddress(formatted);
        setToCoord({ lat, lng });
        setToLocationPrecision('EXACT');
      }

      await saveRecentAddress(formatted, lat, lng);
    } catch (error) {
      console.log(error);
    }
  }, []);

  const changeState = useCallback((newState: PassengerScreenState) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setScreenState(newState);
    Keyboard.dismiss();
  }, []);

  const {
    userProfile,
    profileReady,
    userLocation,
    mapCenter,
    setMapCenter,
  } = usePassengerLocation({
    onResolvedCurrentLocation: async (coords) => {
      setFromCoord(coords);
      setFromLocationPrecision('EXACT');
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
    setShowSearchingDetails(false);
    changeState('IDLE');
  }, [changeState]);

  const handleCourierReturnedToIdle = useCallback(() => {
    setShowSearchingDetails(false);
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
          setShowSearchingDetails(false);
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
            setShowSearchingDetails(false);
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
    setToLocationPrecision('EXACT');
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

  const isSearchingRide =
    activeRide?.status === 'SEARCHING_DRIVER' || activeCourierOrder?.status === 'SEARCHING_COURIER';

  const {
    handleGeocodeAndProceed,
    handleCreateRide,
    handleCancelSearchingRide,
    handleAddressSelect,
    handleCustomLandmarkSelect,
    openSearchSheet,
  } = usePassengerHomeController({
    activeService,
    fromAddress,
    toAddress,
    fromCoord,
    toCoord,
    fromLocationPrecision,
    toLocationPrecision,
    comment,
    offeredPrice,
    stops,
    searchMode,
    courierItemDescription,
    courierPackageWeight,
    courierPackageSize,
    userLocation,
    currentRideId,
    activeRideId,
    activeCourierOrderId,
    setLoading,
    changeState,
    clearCourierState,
    refreshActiveRide,
    setCurrentRideId,
    setActiveRideId,
    setActiveCourierOrderId,
    setActiveCourierOrder,
    setShowSearchingDetails,
    resetTaxiDraft,
    resetCourierDraft,
    setFromAddress,
    setToAddress,
    setFromCoord,
    setToCoord,
    setFromLocationPrecision,
    setToLocationPrecision,
    setStops,
    setSearchMode,
    setIsStopSelectionMode,
    setSearchInitialField,
  });

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

      {screenState === 'IDLE' ? (
        <PassengerIdleOverlay
          fromAddress={fromAddress}
          toAddress={toAddress}
          activeService={activeService}
          activeRideId={activeRideId}
          activeRide={activeRide}
          activeCourierOrderId={activeCourierOrderId}
          unreadNotificationsCount={unreadNotificationsCount}
          onOpenMenu={() => toggleMenu(true)}
          onOpenSearch={openSearchSheet}
          onRecenter={recenterMap}
          onOpenActiveRide={() => changeState('SEARCHING')}
          onOpenActiveCourier={() => {
            setActiveService('Курьер');
            changeState('SEARCHING');
          }}
          onSelectService={(service) => {
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
        />
      ) : null}

      <PassengerSheetHost
        screenState={screenState}
        activeService={activeService}
        loading={loading}
        fromAddress={fromAddress}
        toAddress={toAddress}
        fromCoord={fromCoord}
        toCoord={toCoord}
        fromLocationPrecision={fromLocationPrecision}
        toLocationPrecision={toLocationPrecision}
        offeredPrice={offeredPrice}
        comment={comment}
        stops={stops}
        isStopSelectionMode={isStopSelectionMode}
        showSearchingDetails={showSearchingDetails}
        mapPickTarget={mapPickTarget}
        searchMode={searchMode}
        searchInitialField={searchInitialField}
        courierItemDescription={courierItemDescription}
        courierPackageWeight={courierPackageWeight}
        courierPackageSize={courierPackageSize}
        userLocation={userLocation}
        activeRide={activeRide}
        activeCourierOrder={activeCourierOrder}
        etaSeconds={etaSeconds}
        rideUnreadCount={activeRide ? (rideUnreadById[activeRide.id] ?? 0) : 0}
        mapCenter={mapCenter}
        onCloseSearch={() => {
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
        onMapPickStart={(field) => {
          setMapPickTarget(field);
          setMapCenter(field === 'from' ? (fromCoord ?? userLocation) : (toCoord ?? userLocation));
          changeState('MAP_PICK');
        }}
        onSearchSubmit={handleGeocodeAndProceed}
        onAddressSelect={handleAddressSelect}
        onCustomLandmarkSelect={handleCustomLandmarkSelect}
        onDestinationReady={() => {
          setSearchMode('route');
          setIsStopSelectionMode(false);
          changeState('ORDER_SETUP');
        }}
        onMapPickConfirm={async () => {
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
              setFromLocationPrecision('EXACT');
              await saveRecentAddress(addrStr, mapCenter.lat, mapCenter.lng);
            } else {
              setToAddress(addrStr);
              setToCoord({ lat: mapCenter.lat, lng: mapCenter.lng });
              setToLocationPrecision('EXACT');
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
        onOrder={handleCreateRide}
        onEditAddress={() => changeState('SEARCH')}
        onOrderSetupClose={() => {
          if (activeService === 'Курьер') {
            resetCourierDraft();
          } else {
            resetTaxiDraft();
          }
          changeState('IDLE');
        }}
        setPrice={setOfferedPrice}
        setComment={setComment}
        onRequestAddStop={() => {
          setIsStopSelectionMode(true);
          setSearchMode('stop');
          changeState('SEARCH');
        }}
        onRemoveStop={(indexToRemove) =>
          setStops((current) => current.filter((_, index) => index !== indexToRemove))
        }
        setItemDescription={setCourierItemDescription}
        setPackageWeight={setCourierPackageWeight}
        setPackageSize={setCourierPackageSize}
        onCancelSearching={() => {
          void handleCancelSearchingRide();
        }}
        onShowSearchingDetails={() => setShowSearchingDetails(true)}
        onHideSearchingDetails={() => setShowSearchingDetails(false)}
        onOpenRideChat={
          activeRide
            ? () => {
                navigation.navigate('ChatScreen', { rideId: activeRide.id });
              }
            : undefined
        }
      />

      <PassengerSideDrawer
        visible={isMenuOpen}
        sideMenuAnim={sideMenuAnim}
        menuBackdropOpacity={menuBackdropOpacity}
        fullName={userProfile?.fullName}
        phone={userProfile?.phone}
        unreadNotificationsCount={unreadNotificationsCount}
        unreadMessagesCount={unreadMessagesCount}
        onClose={() => toggleMenu(false)}
        onOpenProfile={() => {
          toggleMenu(false);
          navigation.navigate('PassengerProfile');
        }}
        onOpenNotifications={() => {
          toggleMenu(false);
          navigation.navigate('Notifications');
        }}
        onOpenMessages={() => {
          toggleMenu(false);
          navigation.navigate('Messages');
        }}
        onOpenRideHistory={() => {
          toggleMenu(false);
          navigation.navigate('RideHistory');
        }}
        onOpenFavoriteAddresses={() => {
          toggleMenu(false);
          navigation.navigate('FavoriteAddresses');
        }}
        onLogout={async () => {
          toggleMenu(false);
          await logout();
          navigation.replace('Login');
        }}
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
});
