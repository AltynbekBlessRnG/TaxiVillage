import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { buildRegion, buildRouteCoordinates } from '../../utils/map';
import { darkMinimalMapStyle } from '../../utils/mapStyle';

type Props = NativeStackScreenProps<RootStackParamList, 'RideDetails'>;

interface RideStop {
  address: string;
  lat: number;
  lng: number;
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
  driver?: {
    fullName?: string;
    car?: {
      make?: string;
      model?: string;
      color?: string;
      plateNumber?: string;
    };
  };
}

export const RideDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { rideId } = route.params;
  const [ride, setRide] = useState<RideData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRide = useCallback(() => {
    setLoading(true);
    return apiClient
      .get(`/rides/${rideId}`)
      .then((response) => setRide(response.data))
      .finally(() => setLoading(false));
  }, [rideId]);

  useEffect(() => {
    loadRide().catch(() => null);
  }, [loadRide]);

  useFocusEffect(
    useCallback(() => {
      loadRide().catch(() => null);
      return undefined;
    }, [loadRide]),
  );

  const routeCoordinates = useMemo(
    () =>
      buildRouteCoordinates({
        fromLat: ride?.fromLat,
        fromLng: ride?.fromLng,
        stops: ride?.stops ?? [],
        toLat: ride?.toLat,
        toLng: ride?.toLng,
      }),
    [ride?.fromLat, ride?.fromLng, ride?.stops, ride?.toLat, ride?.toLng],
  );

  const initialRegion = useMemo(
    () =>
      buildRegion(routeCoordinates, {
        latitude: ride?.fromLat ?? 43.2389,
        longitude: ride?.fromLng ?? 76.8897,
      }),
    [ride?.fromLat, ride?.fromLng, routeCoordinates],
  );

  if (loading) {
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
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        mapType="standard"
        customMapStyle={darkMinimalMapStyle}
      >
        {ride?.fromLat && ride?.fromLng ? (
          <Marker coordinate={{ latitude: ride.fromLat, longitude: ride.fromLng }} title="Подача" pinColor="#2563EB" />
        ) : null}

        {ride?.stops?.map((stop, index) => (
          <Marker
            key={`${ride.id}-stop-${index}`}
            coordinate={{ latitude: stop.lat, longitude: stop.lng }}
            title={stop.address}
            pinColor="#F97316"
          />
        ))}

        {ride?.toLat && ride?.toLng ? (
          <Marker coordinate={{ latitude: ride.toLat, longitude: ride.toLng }} title="Назначение" pinColor="#DC2626" />
        ) : null}

        {routeCoordinates.length >= 2 ? (
          <Polyline coordinates={routeCoordinates} strokeColor="#3B82F6" strokeWidth={4} />
        ) : null}
      </MapView>

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>← Назад</Text>
      </TouchableOpacity>

      <View style={styles.bottomSheet}>
        <View style={styles.handleBar} />

        <Text style={styles.eyebrow}>Детали поездки</Text>
        <Text style={styles.title}>{translateStatus(ride?.status || '')}</Text>

        {ride?.driver ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Водитель</Text>
            <Text style={styles.cardValue}>{ride.driver.fullName || 'Водитель'}</Text>
            <Text style={styles.cardMeta}>
              {[ride.driver.car?.make, ride.driver.car?.model, ride.driver.car?.color, ride.driver.car?.plateNumber]
                .filter(Boolean)
                .join(' • ') || 'Автомобиль не указан'}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.routePoint}>
            <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
            <Text style={styles.addressText} numberOfLines={1}>{ride?.fromAddress}</Text>
          </View>

          {ride?.stops?.map((stop, index) => (
            <View key={`${stop.address}-${index}`} style={styles.routePoint}>
              <View style={[styles.dot, { backgroundColor: '#F97316' }]} />
              <Text style={styles.addressText} numberOfLines={1}>{`Заезд: ${stop.address}`}</Text>
            </View>
          ))}

          <View style={styles.routePoint}>
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.addressText} numberOfLines={1}>{ride?.toAddress}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Стоимость поездки</Text>
            <Text style={styles.priceValue}>{Math.round(Number(ride?.finalPrice || ride?.estimatedPrice || 0))} ₸</Text>
          </View>

          {ride?.comment ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.commentLabel}>Комментарий</Text>
              <Text style={styles.commentText}>{ride.comment}</Text>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
};

function translateStatus(status: string): string {
  const t: Record<string, string> = {
    SEARCHING_DRIVER: 'Поиск водителя',
    DRIVER_ASSIGNED: 'Водитель назначен',
    ON_THE_WAY: 'Водитель едет',
    DRIVER_ARRIVED: 'Водитель прибыл',
    IN_PROGRESS: 'Поездка в пути',
    COMPLETED: 'Поездка завершена',
    CANCELED: 'Поездка отменена',
  };
  return t[status] || 'Поездка';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090B',
  },
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
    marginBottom: 18,
  },
  eyebrow: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    textAlign: 'center',
  },
  title: {
    color: '#F4F4F5',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 14,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  cardLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  cardValue: {
    color: '#F4F4F5',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardMeta: {
    color: '#A1A1AA',
    fontSize: 14,
  },
  routePoint: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  addressText: { color: '#E4E4E7', fontSize: 15, fontWeight: '500', flex: 1 },
  divider: { height: 1, backgroundColor: '#27272A', marginVertical: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { color: '#A1A1AA', fontSize: 14, fontWeight: '500' },
  priceValue: { color: '#3B82F6', fontSize: 22, fontWeight: '800' },
  commentLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  commentText: {
    color: '#D4D4D8',
    fontSize: 14,
    lineHeight: 20,
  },
});
