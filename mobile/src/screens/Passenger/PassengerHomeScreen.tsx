import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, type LatLng } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, setAuthToken } from '../../api/client';
import { clearAuth } from '../../storage/authStorage';

// Dark map style for Google Maps
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#64779e' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#334e87' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#0F172A' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#3B82F6' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
];

type Props = NativeStackScreenProps<RootStackParamList, 'PassengerHome'>;

export const PassengerHomeScreen: React.FC<Props> = ({ navigation }) => {
  const mapRef = useRef<MapView | null>(null);
  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [fromCoord, setFromCoord] = useState<LatLng | null>(null);
  const [toCoord, setToCoord] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromFocused, setFromFocused] = useState(false);
  const [toFocused, setToFocused] = useState(false);

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

  const handleLogout = async () => {
    await clearAuth();
    setAuthToken(null);
    navigation.replace('Login');
  };

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
      {/* Full screen map as background */}
      <View style={styles.mapContainer}>
        {initialRegion ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            customMapStyle={darkMapStyle}
          >
            {fromCoord && <Marker coordinate={fromCoord} title="Откуда" pinColor="#3B82F6" />}
            {toCoord && <Marker coordinate={toCoord} title="Куда" pinColor="#EF4444" />}
            {fromCoord && toCoord && (
              <Polyline coordinates={[fromCoord, toCoord]} strokeWidth={4} strokeColor="#3B82F6" />
            )}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>Определяем геопозицию…</Text>
          </View>
        )}
      </View>

      {/* Floating Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.handleBar} />

        {/* From Input with Icon */}
        <View style={styles.inputContainer}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>●</Text>
          </View>
          <TextInput
            style={[styles.input, fromFocused && styles.inputFocused]}
            placeholder="Откуда"
            placeholderTextColor="#64748B"
            value={fromAddress}
            onChangeText={setFromAddress}
            onFocus={() => setFromFocused(true)}
            onBlur={() => setFromFocused(false)}
          />
        </View>

        {/* To Input with Icon */}
        <View style={styles.inputContainer}>
          <View style={[styles.iconCircle, styles.iconCircleRed]}>
            <Text style={[styles.iconText, styles.iconTextRed]}>⚑</Text>
          </View>
          <TextInput
            style={[styles.input, toFocused && styles.inputFocused]}
            placeholder="Куда"
            placeholderTextColor="#64748B"
            value={toAddress}
            onChangeText={setToAddress}
            onFocus={() => setToFocused(true)}
            onBlur={() => setToFocused(false)}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {/* Large Primary Button */}
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={createRide}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? 'Создание...' : 'Заказать такси'}
          </Text>
        </TouchableOpacity>

        {/* Secondary Buttons */}
        <View style={styles.secondaryButtons}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('RideHistory')}
          >
            <Text style={styles.secondaryButtonText}>История</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Выйти</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  mapPlaceholderText: {
    color: '#64748B',
    fontSize: 16,
  },
  // Floating Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    borderWidth: 1,
    borderColor: '#334155',
    borderBottomWidth: 0,
    minHeight: height * 0.4,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#475569',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  // Inputs with Icons
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F620',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconCircleRed: {
    backgroundColor: '#EF444420',
  },
  iconText: {
    color: '#3B82F6',
    fontSize: 14,
  },
  iconTextRed: {
    color: '#EF4444',
  },
  input: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F8FAFC',
    fontSize: 16,
  },
  inputFocused: {
    borderColor: '#3B82F6',
  },
  error: {
    color: '#EF4444',
    marginBottom: 12,
    fontSize: 14,
  },
  // Buttons
  primaryButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#7F1D1D',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '600',
  },
});

