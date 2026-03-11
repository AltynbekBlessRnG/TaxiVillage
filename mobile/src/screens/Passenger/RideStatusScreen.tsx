import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Modal, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Polyline } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createRidesSocket } from '../../api/socket';
import { loadAuth } from '../../storage/authStorage';

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

export const RideStatusScreen: React.FC<Props> = ({ route, navigation }: Props) => {
  const { rideId } = route.params;
  const [status, setStatus] = useState<string>('');
  const [driverInfo, setDriverInfo] = useState<string | null>(null);
  const [priceInfo, setPriceInfo] = useState<string | null>(null);
  const [ride, setRide] = useState<RideData | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showRating, setShowRating] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    let isMounted = true;
    let socket: ReturnType<typeof createRidesSocket> | null = null;
    let cleanupFn: (() => void) | null = null;

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
        
        const handleRideUpdated = (updatedRide: RideData & { id: string }) => {
          if (isMounted && updatedRide.id === rideId) {
            setRide(updatedRide);
            applyRideToState(updatedRide, setStatus, setDriverInfo, setPriceInfo, setDriverLocation);
            
            // Show rating modal when ride is completed
            if (updatedRide.status === 'COMPLETED' && !showRating) {
              setShowRating(true);
            }
          }
        };

        const handleDriverMoved = (data: { rideId: string; lat: number; lng: number }) => {
          if (isMounted && data.rideId === rideId) {
            setDriverLocation({ lat: data.lat, lng: data.lng });
          }
        };

        const handleRideCreated = (updatedRide: RideData & { id: string }) => {
          if (isMounted && updatedRide.id === rideId) {
            applyRideToState(updatedRide, setStatus, setDriverInfo, setPriceInfo, setDriverLocation);
          }
        };
        
        // Add all event listeners
        socket.on('ride:created', handleRideCreated);
        socket.on('ride:updated', handleRideUpdated);
        socket.on('driver:moved', handleDriverMoved);

        // Store cleanup function
        cleanupFn = () => {
          if (socket) {
            socket.off('ride:created', handleRideCreated);
            socket.off('ride:updated', handleRideUpdated);
            socket.off('driver:moved', handleDriverMoved);
            socket.disconnect();
          }
        };
      } catch {
        // ignore
        cleanupFn = () => {}; // Return empty cleanup function on error
      }
    };

    init();
    
    return () => {
      isMounted = false;
      cleanupFn?.(); // Execute the cleanup function
    };
  }, [rideId, showRating]);

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
      // @ts-ignore
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
      {/* Map View as full background */}
      {ride && (ride.fromLat || ride.fromLng) && (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          customMapStyle={darkMapStyle}
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
              pinColor="#10B981"
            />
          )}
          
          {/* Destination marker */}
          {ride.toLat && ride.toLng && (
            <Marker
              coordinate={{ latitude: ride.toLat, longitude: ride.toLng }}
              title="Куда"
              pinColor="#EF4444"
            />
          )}
          
          {/* Driver marker */}
          {driverLocation && (
            <Marker
              coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}
              title="Водитель"
              pinColor="#3B82F6"
            />
          )}

          {/* Route polyline */}
          {ride.fromLat && ride.fromLng && ride.toLat && ride.toLng && (
            <Polyline
              coordinates={[
                { latitude: ride.fromLat, longitude: ride.fromLng },
                { latitude: ride.toLat, longitude: ride.toLng },
              ]}
              strokeWidth={4}
              strokeColor="#3B82F6"
            />
          )}
        </MapView>
      )}

      {/* Floating Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.handleBar} />

        <Text style={styles.title}>Статус поездки</Text>
        
        <View style={styles.statusCard}>
          <View style={[styles.statusDot, getStatusDotColor(status)]} />
          <Text style={styles.statusText}>{translateStatus(status)}</Text>
        </View>

        {driverInfo && (
          <View style={styles.driverCard}>
            <Text style={styles.driverLabel}>Водитель</Text>
            <Text style={styles.driverText}>{driverInfo}</Text>
          </View>
        )}

        {priceInfo && (
          <View style={styles.priceCard}>
            <Text style={styles.priceText}>{priceInfo}</Text>
          </View>
        )}
        
        <View style={styles.buttonGroup}>
          {canCancel && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Отменить поездку</Text>
            </TouchableOpacity>
          )}
          
          {status === 'DRIVER_ASSIGNED' && (
            <TouchableOpacity 
              style={styles.secondaryButton}
              // @ts-ignore
              onPress={() => navigation.navigate('ChatScreen', { rideId })}
            >
              <Text style={styles.secondaryButtonText}>💬 Чат с водителем</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.homeButton}
            // @ts-ignore
            onPress={() => navigation.replace('PassengerHome')}
          >
            <Text style={styles.homeButtonText}>На главный экран</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rating Modal */}
      <Modal
        visible={showRating}
        transparent
        animationType="fade"
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
            <TouchableOpacity 
              style={styles.skipButton}
              onPress={() => setShowRating(false)}
            >
              <Text style={styles.skipButtonText}>Пропустить</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Helper functions for status styling
function getStatusDotColor(status: string) {
  switch (status) {
    case 'COMPLETED':
      return { backgroundColor: '#10B981' };
    case 'CANCELED':
      return { backgroundColor: '#EF4444' };
    case 'IN_PROGRESS':
    case 'ON_THE_WAY':
      return { backgroundColor: '#3B82F6' };
    case 'DRIVER_ASSIGNED':
      return { backgroundColor: '#F59E0B' };
    default:
      return { backgroundColor: '#64748B' };
  }
}

function translateStatus(status: string): string {
  const translations: Record<string, string> = {
    'SEARCHING_DRIVER': 'Поиск водителя...',
    'DRIVER_ASSIGNED': 'Водитель назначен',
    'ON_THE_WAY': 'Водитель в пути',
    'IN_PROGRESS': 'Поездка в процессе',
    'COMPLETED': 'Поездка завершена',
    'CANCELED': 'Поездка отменена',
  };
  return translations[status] || status;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
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
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#475569',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 16,
    textAlign: 'center',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  statusText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  driverCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  driverLabel: {
    color: '#94A3B8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  driverText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '500',
  },
  priceCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  priceText: {
    color: '#10B981',
    fontSize: 24,
    fontWeight: '700',
  },
  buttonGroup: {
    gap: 12,
  },
  cancelButton: {
    backgroundColor: '#7F1D1D',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#991B1B',
  },
  cancelButtonText: {
    color: '#FCA5A5',
    fontSize: 16,
    fontWeight: '600',
  },
  homeButton: {
    backgroundColor: '#334155',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#334155',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    minWidth: 280,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
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
    fontSize: 36,
  },
  skipButton: {
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
});

