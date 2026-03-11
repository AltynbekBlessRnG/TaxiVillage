import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Button, StyleSheet, Switch, Alert } from 'react-native';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createRidesSocket } from '../../api/socket';
import { loadAuth } from '../../storage/authStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverHome'>;

interface RideOffer {
  id: string;
  fromAddress: string;
  toAddress: string;
  estimatedPrice?: number;
  fromLat: number;
  fromLng: number;
}

interface DriverProfile {
  balance?: number;
  rating?: number;
}

export const DriverHomeScreen: React.FC<Props> = ({ navigation }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [profile, setProfile] = useState<DriverProfile | null>(null);

  const toggleOnline = async (value: boolean) => {
    setIsOnline(value);
    try {
      await apiClient.post('/drivers/status', { isOnline: value });
      if (value) {
        // Refresh profile when going online
        const res = await apiClient.get('/drivers/profile');
        setProfile(res.data);
      }
    } catch {
      // ignore in MVP
    }
  };

  const acceptRide = useCallback(async (rideId: string) => {
    try {
      await apiClient.post(`/rides/${rideId}/accept`);
      setCurrentRideId(rideId);
    } catch {
      Alert.alert('Ошибка', 'Не удалось принять заказ');
    }
  }, []);

  const rejectRide = useCallback(async (rideId: string) => {
    try {
      await apiClient.post(`/rides/${rideId}/reject`);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Load profile on mount
    const loadProfile = async () => {
      try {
        const res = await apiClient.get('/drivers/profile');
        setProfile(res.data);
      } catch {
        // ignore
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    if (!isOnline) {
      setCurrentRideId(null);
      return;
    }

    let socket: ReturnType<typeof createRidesSocket> | null = null;
    let isMounted = true;
    let locationSubscription: Location.LocationSubscription | null = null;

    const init = async () => {
      try {
        const auth = await loadAuth();
        if (!isMounted || !auth?.token) return;

        const res = await apiClient.get('/drivers/current-ride');
        if (isMounted && res.data?.id) {
          setCurrentRideId(res.data.id);
        }

        socket = createRidesSocket(auth.token);
        
        // Handle ride offers
        socket.on('ride:offer', (ride: RideOffer) => {
          if (!isMounted) return;
          
          // Calculate distance (simplified)
          const distance = '—';
          const price = ride.estimatedPrice ? Math.round(ride.estimatedPrice) : '—';
          
          Alert.alert(
            'Новый заказ',
            `От: ${ride.fromAddress}\nДо: ${ride.toAddress}\nЦена: ${price} ₽`,
            [
              { text: 'Пропустить', onPress: () => rejectRide(ride.id) },
              { text: 'Принять', onPress: () => acceptRide(ride.id) },
            ]
          );
        });

        socket.on('ride:created', (ride: { id: string }) => {
          if (isMounted) setCurrentRideId(ride.id);
        });
        socket.on('ride:updated', (ride: { id: string; status?: string }) => {
          if (isMounted) {
            if (ride.status === 'COMPLETED' || ride.status === 'CANCELED') {
              setCurrentRideId(null);
            } else {
              setCurrentRideId(ride.id);
            }
          }
        });

        // Start location tracking
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          locationSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 10000, // 10 seconds
              distanceInterval: 50, // 50 meters
            },
            async (location) => {
              try {
                await apiClient.patch('/drivers/location', {
                  lat: location.coords.latitude,
                  lng: location.coords.longitude,
                });
              } catch {
                // ignore
              }
            }
          );
        }
      } catch {
        // ignore
      }
    };

    init();
    return () => {
      isMounted = false;
      socket?.disconnect();
      locationSubscription?.remove();
    };
  }, [isOnline, acceptRide, rejectRide]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Режим водителя</Text>
      
      {profile && (
        <View style={styles.profileCard}>
          <Text style={styles.balance}>Баланс: {profile.balance ?? 0} ₽</Text>
          <Text style={styles.rating}>Рейтинг: {(profile.rating ?? 5).toFixed(1)} ⭐</Text>
        </View>
      )}
      
      <View style={styles.row}>
        <Text>Онлайн</Text>
        <Switch value={isOnline} onValueChange={toggleOnline} />
      </View>

      {currentRideId ? (
        <Button title="Перейти к поездке" onPress={() => navigation.navigate('DriverRide', { rideId: currentRideId })} />
      ) : (
        <Text style={styles.info}>Ожидание заказов...</Text>
      )}
      <Button
        title="История поездок"
        onPress={() => navigation.navigate('RideHistory')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  profileCard: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  balance: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 4,
  },
  rating: {
    fontSize: 16,
    color: '#f57c00',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  info: {
    marginTop: 16,
    fontSize: 16,
  },
});

