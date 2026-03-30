import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { darkMinimalMapStyle } from '../../../utils/mapStyle';

type Props = {
  mapRef: React.RefObject<MapView | null>;
  initialRegion: any;
  screenState: 'IDLE' | 'SEARCH' | 'MAP_PICK' | 'ORDER_SETUP' | 'SEARCHING';
  activeService: 'Такси' | 'Курьер' | 'Еда' | 'Межгород';
  userLocation?: { lat: number; lng: number } | null;
  nearbyDrivers: Array<{ id: string; lat: number; lng: number; fullName: string }>;
  activeRide?: any;
  driverLocation?: { lat: number; lng: number } | null;
  activeCourierOrder?: any;
  courierLocation?: { lat: number; lng: number } | null;
  routeCoordinates: Array<{ latitude: number; longitude: number }>;
  onRegionChangeComplete?: (region: any) => void;
  showMapPickPin?: boolean;
  showSearchingRadar?: boolean;
};

const SearchingRadarMarker: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makePulse = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const animationA = makePulse(pulseA, 0);
    const animationB = makePulse(pulseB, 900);
    animationA.start();
    animationB.start();

    return () => {
      animationA.stop();
      animationB.stop();
    };
  }, [pulseA, pulseB]);

  const buildRingStyle = (value: Animated.Value) => ({
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0.35, 1.8],
        }),
      },
    ],
    opacity: value.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [0.6, 0.25, 0],
    }),
  });

  return (
    <Marker
      coordinate={{ latitude: lat, longitude: lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges
      zIndex={2}
    >
      <View style={styles.radarContainer}>
        <Animated.View style={[styles.radarRing, buildRingStyle(pulseA)]} />
        <Animated.View style={[styles.radarRing, buildRingStyle(pulseB)]} />
        <View style={styles.radarCore} />
      </View>
    </Marker>
  );
};

export const PassengerMapScene: React.FC<Props> = React.memo(({
  mapRef,
  initialRegion,
  screenState,
  activeService,
  userLocation,
  nearbyDrivers,
  activeRide,
  driverLocation,
  activeCourierOrder,
  courierLocation,
  routeCoordinates,
  onRegionChangeComplete,
  showMapPickPin,
  showSearchingRadar,
}) => (
  <View style={styles.mapContainer}>
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      initialRegion={initialRegion}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      mapType="standard"
      customMapStyle={darkMinimalMapStyle}
      showsUserLocation={false}
      onRegionChangeComplete={onRegionChangeComplete}
    >
      {userLocation ? (
        <Marker identifier="user" coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }} title="Вы" pinColor="#2563EB" />
      ) : null}

      {showSearchingRadar && userLocation ? (
        <SearchingRadarMarker lat={userLocation.lat} lng={userLocation.lng} />
      ) : null}

      {!activeRide && !activeCourierOrder
        ? nearbyDrivers.map((driver) => (
            <Marker key={driver.id} coordinate={{ latitude: driver.lat, longitude: driver.lng }} title={driver.fullName} pinColor="#EF4444" />
          ))
        : null}

      {routeCoordinates.length >= 2 ? (
        <Polyline
          coordinates={routeCoordinates}
          strokeColor={activeService === 'Курьер' || activeCourierOrder ? '#F59E0B' : '#3B82F6'}
          strokeWidth={4}
          lineDashPattern={
            activeRide?.status === 'SEARCHING_DRIVER' ||
            activeCourierOrder?.status === 'SEARCHING_COURIER' ||
            screenState === 'SEARCHING'
              ? [8, 6]
              : undefined
          }
        />
      ) : null}

      {activeRide?.fromLat && activeRide?.fromLng ? (
        <Marker coordinate={{ latitude: activeRide.fromLat, longitude: activeRide.fromLng }} title="Подача" pinColor="#2563EB" />
      ) : null}
      {activeRide?.stops?.map((stop: any, index: number) => (
        <Marker key={`${activeRide.id}-stop-${index}`} coordinate={{ latitude: stop.lat, longitude: stop.lng }} title={stop.address} pinColor="#F97316" />
      ))}
      {activeRide?.toLat && activeRide?.toLng ? (
        <Marker coordinate={{ latitude: activeRide.toLat, longitude: activeRide.toLng }} title="Назначение" pinColor="#DC2626" />
      ) : null}
      {driverLocation ? (
        <Marker coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }} title="Водитель" pinColor="#F59E0B" />
      ) : null}

      {activeCourierOrder?.pickupLat && activeCourierOrder?.pickupLng ? (
        <Marker coordinate={{ latitude: activeCourierOrder.pickupLat, longitude: activeCourierOrder.pickupLng }} title="Забор" pinColor="#2563EB" />
      ) : null}
      {activeCourierOrder?.dropoffLat && activeCourierOrder?.dropoffLng ? (
        <Marker coordinate={{ latitude: activeCourierOrder.dropoffLat, longitude: activeCourierOrder.dropoffLng }} title="Доставка" pinColor="#DC2626" />
      ) : null}
      {courierLocation ? (
        <Marker coordinate={{ latitude: courierLocation.lat, longitude: courierLocation.lng }} title="Курьер" pinColor="#F59E0B" />
      ) : null}
    </MapView>

    {showMapPickPin ? (
      <View style={styles.centerPinContainer} pointerEvents="none">
        <View style={styles.ashenPin} />
      </View>
    ) : null}
  </View>
));

const styles = StyleSheet.create({
  mapContainer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
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
  radarContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
  },
  radarCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    borderWidth: 3,
    borderColor: '#DBEAFE',
  },
});
