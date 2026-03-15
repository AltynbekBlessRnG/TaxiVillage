import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Modal, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Polyline } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createRidesSocket } from '../../api/socket';
import { loadAuth } from '../../storage/authStorage';
import { ChatScreen } from '../../components/Chat/ChatScreen';
import { RideCompletionModal } from '../../components/RideCompletionModal';
import { sendLocalNotification, NOTIFICATION_TYPES } from '../../utils/notifications';

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
  id: string;
  status: string;
  fromAddress: string;
  toAddress: string;
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
  comment?: string;
  stops?: Array<{ address: string; lat: number; lng: number }>;
  estimatedPrice?: number;
  finalPrice?: number;
  driver?: {
    id: string;
    fullName: string;
    phone: string;
    lat?: number;
    lng?: number;
    car?: {
      brand: string;
      model: string;
      color: string;
      plateNumber: string;
    };
  };
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
  const [showChat, setShowChat] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    let isMounted = true;
    let socket: ReturnType<typeof createRidesSocket> | null = null;
    let cleanupFn: (() => void) | null = null;

    const init = async () => {
      try {
        // Get current user ID
        const auth = await loadAuth();
        if (auth?.userId) {
          setCurrentUserId(auth.userId);
        }
        
        const response = await apiClient.get(`/rides/${rideId}`);
        if (!isMounted) return;
        setRide(response.data);
        applyRideToState(response.data, setStatus, setDriverInfo, setPriceInfo, setDriverLocation);

        if (!isMounted || !auth?.token) return;

        socket = createRidesSocket(auth.token);
        
        // Join ride room for driver tracking
        socket.emit('join:ride', rideId);
        
        const handleRideUpdated = (updatedRide: RideData & { id: string }) => {
          if (isMounted && updatedRide.id === rideId) {
            setRide(updatedRide);
            applyRideToState(updatedRide, setStatus, setDriverInfo, setPriceInfo, setDriverLocation);
            
            // Show completion modal when ride is completed
            if (updatedRide.status === 'COMPLETED' && !showCompletionModal) {
              // Send notification
              sendLocalNotification(
                'Поездка завершена',
                `К оплате: ${updatedRide.finalPrice || updatedRide.estimatedPrice} ₽`,
                { type: 'RIDE_COMPLETED', rideId: updatedRide.id }
              );
              
              setShowCompletionModal(true);
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

        {/* Route Information */}
        <View style={styles.routeCard}>
          <Text style={styles.routeLabel}>Маршрут</Text>
          <View style={styles.routePoint}>
            <View style={[styles.pointDot, styles.greenDot]} />
            <Text style={styles.routeText}>{ride?.fromAddress}</Text>
          </View>
          {ride?.stops && ride.stops.length > 0 && (
            ride.stops.map((stop, index) => (
              <View key={index} style={styles.routePoint}>
                <View style={[styles.pointDot, styles.orangeDot]} />
                <Text style={styles.routeText}>{stop.address}</Text>
              </View>
            ))
          )}
          <View style={styles.routePoint}>
            <View style={[styles.pointDot, styles.redDot]} />
            <Text style={styles.routeText}>{ride?.toAddress}</Text>
          </View>
        </View>

        {/* Comment */}
        {ride?.comment && (
          <View style={styles.commentCard}>
            <Text style={styles.commentLabel}>Комментарий</Text>
            <Text style={styles.commentText}>{ride.comment}</Text>
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
          
          {status === 'DRIVER_ASSIGNED' && ride?.driver && (
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => setShowChat(true)}
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

      {/* Ride Completion Modal */}
      <RideCompletionModal
        visible={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        rideId={rideId}
        finalPrice={ride?.finalPrice || ride?.estimatedPrice || 0}
        driverName={ride?.driver?.fullName || 'Водитель'}
        onRatingSubmitted={() => navigation.replace('PassengerHome', {})}
      />

      {/* Chat Modal */}
      <ChatScreen
        visible={showChat}
        onClose={() => setShowChat(false)}
        rideId={rideId}
        currentUserId={currentUserId}
        userType="PASSENGER"
        receiverId={ride?.driver?.id || ''}
        receiverName={ride?.driver?.fullName || 'Водитель'}
      />
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
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  driverCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  driverLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
    marginBottom: 4,
  },
  driverText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  routeCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
    marginBottom: 8,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pointDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  greenDot: {
    backgroundColor: '#10B981',
  },
  orangeDot: {
    backgroundColor: '#F97316',
  },
  redDot: {
    backgroundColor: '#EF4444',
  },
  routeText: {
    fontSize: 14,
    color: '#E2E8F0',
    flex: 1,
  },
  commentCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  commentLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#E2E8F0',
  },
  priceCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
    textAlign: 'center',
  },
  buttonGroup: {
    gap: 12,
  },
  cancelButton: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  homeButton: {
    backgroundColor: '#475569',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Rating Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 24,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  starButton: {
    padding: 8,
  },
  star: {
    fontSize: 32,
  },
  skipButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#475569',
    borderRadius: 8,
  },
  skipButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

