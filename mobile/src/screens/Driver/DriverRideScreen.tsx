import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, type LatLng } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverRide'>;

export const DriverRideScreen: React.FC<Props> = ({ route, navigation }) => {
  const { rideId } = route.params;
  const [status, setStatus] = useState<string>('');
  const [fromCoord, setFromCoord] = useState<LatLng | null>(null);
  const [toCoord, setToCoord] = useState<LatLng | null>(null);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    const fetchRide = async () => {
      try {
        const response = await apiClient.get(`/rides/${rideId}`);
        setStatus(response.data.status);
        const fromLat: number = response.data.fromLat;
        const fromLng: number = response.data.fromLng;
        const toLat: number = response.data.toLat;
        const toLng: number = response.data.toLng;
        const hasFrom = Number.isFinite(fromLat) && Number.isFinite(fromLng) && (fromLat !== 0 || fromLng !== 0);
        const hasTo = Number.isFinite(toLat) && Number.isFinite(toLng) && (toLat !== 0 || toLng !== 0);
        setFromCoord(hasFrom ? { latitude: fromLat, longitude: fromLng } : null);
        setToCoord(hasTo ? { latitude: toLat, longitude: toLng } : null);
      } catch {
        // ignore
      }
    };
    fetchRide();
  }, [rideId]);

  useEffect(() => {
    if (!mapRef.current || !fromCoord || !toCoord) return;
    mapRef.current.fitToCoordinates([fromCoord, toCoord], {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: true,
    });
  }, [fromCoord, toCoord]);

  const initialRegion = useMemo(() => {
    const base = fromCoord ?? toCoord;
    if (!base) return undefined;
    return {
      latitude: base.latitude,
      longitude: base.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }, [fromCoord, toCoord]);

  const updateStatus = async (newStatus: string) => {
    try {
      await apiClient.post(`/rides/${rideId}/status`, { status: newStatus });
      setStatus(newStatus);
      if (newStatus === 'COMPLETED') {
        navigation.replace('DriverHome');
      }
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        {initialRegion ? (
          <MapView ref={(r) => (mapRef.current = r)} style={styles.map} initialRegion={initialRegion}>
            {fromCoord && <Marker coordinate={fromCoord} title="A" />}
            {toCoord && <Marker coordinate={toCoord} title="B" pinColor="#007AFF" />}
            {fromCoord && toCoord && (
              <Polyline coordinates={[fromCoord, toCoord]} strokeWidth={4} strokeColor="#007AFF" />
            )}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>Координаты недоступны</Text>
          </View>
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Текущая поездка</Text>
        <Text style={styles.status}>Статус: {status}</Text>
        <Button title="Еду к клиенту" onPress={() => updateStatus('ON_THE_WAY')} />
        <Button title="Везу клиента" onPress={() => updateStatus('IN_PROGRESS')} />
        <Button title="Завершить поездку" onPress={() => updateStatus('COMPLETED')} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapWrap: {
    flex: 1,
    backgroundColor: '#eee',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    color: '#666',
  },
  panel: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  status: {
    fontSize: 16,
    marginBottom: 16,
  },
});

