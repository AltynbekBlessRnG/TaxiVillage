import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, type LatLng } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'PassengerHome'>;

export const PassengerHomeScreen: React.FC<Props> = ({ navigation }) => {
  const mapRef = useRef<MapView | null>(null);
  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCoord, setFromCoord] = useState<LatLng | null>(null);
  const [toCoord, setToCoord] = useState<LatLng | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!mounted) return;
        setFromCoord({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const q = toAddress.trim();
    if (!q) {
      setToCoord(null);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const results = await Location.geocodeAsync(q);
        if (cancelled) return;
        if (results.length > 0) {
          setToCoord({ latitude: results[0].latitude, longitude: results[0].longitude });
        } else {
          setToCoord(null);
        }
      } catch {
        if (!cancelled) setToCoord(null);
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [toAddress]);

  useEffect(() => {
    if (!mapRef.current || !fromCoord || !toCoord) return;
    mapRef.current.fitToCoordinates([fromCoord, toCoord], {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: true,
    });
  }, [fromCoord, toCoord]);

  const initialRegion = useMemo(() => {
    if (!fromCoord) return undefined;
    return {
      latitude: fromCoord.latitude,
      longitude: fromCoord.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }, [fromCoord]);

  const createRide = async () => {
    setLoading(true);
    setError(null);
    try {
      const fromLat = fromCoord?.latitude;
      const fromLng = fromCoord?.longitude;
      const toLat = toCoord?.latitude;
      const toLng = toCoord?.longitude;

      const payload: {
        fromAddress: string;
        toAddress: string;
        fromLat?: number;
        fromLng?: number;
        toLat?: number;
        toLng?: number;
      } = { fromAddress, toAddress };
      if (fromLat != null && fromLng != null) {
        payload.fromLat = fromLat;
        payload.fromLng = fromLng;
      }
      if (toLat != null && toLng != null) {
        payload.toLat = toLat;
        payload.toLng = toLng;
      }

      const response = await apiClient.post('/rides', payload);
      const rideId: string = response.data.id;
      navigation.navigate('RideStatus', { rideId });
    } catch (e) {
      setError('Не удалось создать поездку.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        {initialRegion ? (
          <MapView ref={(r) => (mapRef.current = r)} style={styles.map} initialRegion={initialRegion}>
            {fromCoord && <Marker coordinate={fromCoord} title="Откуда" />}
            {toCoord && <Marker coordinate={toCoord} title="Куда" pinColor="#007AFF" />}
            {fromCoord && toCoord && (
              <Polyline coordinates={[fromCoord, toCoord]} strokeWidth={4} strokeColor="#007AFF" />
            )}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>Определяем геопозицию…</Text>
          </View>
        )}
      </View>

      <View style={styles.form}>
        <Text style={styles.title}>Новая поездка</Text>
        <TextInput
          style={styles.input}
          placeholder="Откуда"
          value={fromAddress}
          onChangeText={setFromAddress}
        />
        <TextInput
          style={styles.input}
          placeholder="Куда"
          value={toAddress}
          onChangeText={setToAddress}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Button title={loading ? 'Создание...' : 'Заказать'} onPress={createRide} disabled={loading} />
        <View style={styles.spacer} />
        <Button title="История поездок" onPress={() => navigation.navigate('RideHistory')} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
  form: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  error: {
    color: 'red',
    marginBottom: 8,
  },
  spacer: {
    height: 10,
  },
});

