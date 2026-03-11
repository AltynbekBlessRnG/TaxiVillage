import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Button, StyleSheet, Alert, Modal, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createRidesSocket } from '../../api/socket';
import { loadAuth } from '../../storage/authStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'RideStatus'>;

interface RideData {
  status?: string;
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
  driver?: { fullName?: string; car?: { plateNumber?: string }; lat?: number; lng?: number };
  finalPrice?: number | string;
  estimatedPrice?: number | string;
}

function applyRideToState(
  ride: RideData,
  setStatus: (s: string) => void,
  setDriverInfo: (s: string | null) => void,
  setPriceInfo: (s: string | null) => void,
  setDriverLocation?: (loc: { lat: number; lng: number } | null) => void,
) {
  if (ride.status) setStatus(ride.status);
  if (ride.driver) {
    setDriverInfo(`${ride.driver.fullName || 'Водитель'} • ${ride.driver.car?.plateNumber ?? ''}`);
    if (ride.driver.lat && ride.driver.lng && setDriverLocation) {
      setDriverLocation({ lat: ride.driver.lat, lng: ride.driver.lng });
    }
  }
  const final = ride.finalPrice != null ? Number(ride.finalPrice) : null;
  const est = ride.estimatedPrice != null ? Number(ride.estimatedPrice) : null;
  if (final != null) {
    setPriceInfo(`Итого: ${Math.round(final)} ₽`);
  } else if (est != null) {
    setPriceInfo(`Примерно: ${Math.round(est)} ₽`);
  } else {
    setPriceInfo(null);
  }
}

export const RideStatusScreen: React.FC<Props> = ({ route, navigation }) => {
  const { rideId } = route.params;
  const [status, setStatus] = useState<string>('');
  const [driverInfo, setDriverInfo] = useState<string | null>(null);
  const [priceInfo, setPriceInfo] = useState<string | null>(null);
  const [ride, setRide] = useState<RideData | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showRating, setShowRating] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    let socket: ReturnType<typeof createRidesSocket> | null = null;
    let isMounted = true;

    const init = async () => {
      try {
        const response = await apiClient.get(`/rides/${rideId}`);
        if (!isMounted) return;
        setRide(response.data);
        applyRideToState(response.data, setStatus, setDriverInfo, setPriceInfo, setDriverLocation);

        const auth = await loadAuth();
        if (!isMounted || !auth?.token) return;

        socket = createRidesSocket(auth.token);
        
        // Join ride room for driver tracking
        socket.emit('join:ride', rideId);
        
        socket.on('ride:updated', (updatedRide: RideData & { id: string }) => {
          if (isMounted && updatedRide.id === rideId) {
            setRide(updatedRide);
            applyRideToState(updatedRide, setStatus, setDriverInfo, setPriceInfo, setDriverLocation);
            
            // Show rating modal when ride is completed
            if (updatedRide.status === 'COMPLETED' && !showRating) {
              setShowRating(true);
            }
          }
        });
        
        socket.on('driver:moved', (data: { rideId: string; lat: number; lng: number }) => {
          if (isMounted && data.rideId === rideId) {
            setDriverLocation({ lat: data.lat, lng: data.lng });
          }
        });
        
        socket.on('ride:created', (updatedRide: RideData & { id: string }) => {
          if (isMounted && updatedRide.id === rideId) {
            applyRideToState(updatedRide, setStatus, setDriverInfo, setPriceInfo, setDriverLocation);
          }
        });
      } catch {
        // ignore
      }
    };

    init();
    return () => {
      isMounted = false;
      socket?.disconnect();
    };
  }, [rideId]);

  // Fit map to show markers when driver location changes
  useEffect(() => {
    if (mapRef.current && ride && (driverLocation || (ride.fromLat && ride.fromLng))) {
      const coordinates = [];
      if (ride.fromLat && ride.fromLng) {
        coordinates.push({ latitude: ride.fromLat, longitude: ride.fromLng });
      }
      if (ride.toLat && ride.toLng) {
        coordinates.push({ latitude: ride.toLat, longitude: ride.toLng });
      }
      if (driverLocation) {
        coordinates.push({ latitude: driverLocation.lat, longitude: driverLocation.lng });
      }
      
      if (coordinates.length > 0) {
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    }
  }, [driverLocation, ride]);

  const canCancel = status === 'SEARCHING_DRIVER' || status === 'DRIVER_ASSIGNED';

  const handleCancel = async () => {
    try {
      await apiClient.post(`/rides/${rideId}/cancel`);
      navigation.replace('PassengerHome');
    } catch {
      // ignore
    }
  };

  const submitRating = async (stars: number) => {
    try {
      await apiClient.post(`/rides/${rideId}/rate`, { stars });
      setShowRating(false);
      Alert.alert('Спасибо!', 'Ваша оценка сохранена');
    } catch {
      Alert.alert('Ошибка', 'Не удалось сохранить оценку');
    }
  };

  return (
    <View style={styles.container}>
      {/* Map View */}
      {ride && (ride.fromLat || ride.fromLng) && (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: ride.fromLat ?? 0,
            longitude: ride.fromLng ?? 0,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          {/* Pickup marker */}
          {ride.fromLat && ride.fromLng && (
            <Marker
              coordinate={{ latitude: ride.fromLat, longitude: ride.fromLng }}
              title="Откуда"
              pinColor="green"
            />
          )}
          
          {/* Destination marker */}
          {ride.toLat && ride.toLng && (
            <Marker
              coordinate={{ latitude: ride.toLat, longitude: ride.toLng }}
              title="Куда"
              pinColor="red"
            />
          )}
          
          {/* Driver marker */}
          {driverLocation && (
            <Marker
              coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}
              title="Водитель"
              pinColor="blue"
            />
          )}
        </MapView>
      )}

      <View style={styles.infoContainer}>
        <Text style={styles.title}>Статус поездки</Text>
        <Text style={styles.status}>{status}</Text>
        {driverInfo && <Text style={styles.driver}>{driverInfo}</Text>}
        {priceInfo && <Text style={styles.price}>{priceInfo}</Text>}
        
        {canCancel && (
          <Button title="Отменить поездку" onPress={handleCancel} color="#c00" />
        )}
        <Button title="На главный экран" onPress={() => navigation.replace('PassengerHome')} />
      </View>

      {/* Rating Modal */}
      <Modal
        visible={showRating}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRating(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Оцените поездку</Text>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => submitRating(star)}
                  style={styles.starButton}
                >
                  <Text style={styles.star}>⭐</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button title="Пропустить" onPress={() => setShowRating(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 2,
    width: '100%',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  status: {
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  driver: {
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  price: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 280,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  starButton: {
    padding: 8,
  },
  star: {
    fontSize: 32,
  },
});

