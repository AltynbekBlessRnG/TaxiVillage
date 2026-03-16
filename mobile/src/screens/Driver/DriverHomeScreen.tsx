import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Switch, Alert, TouchableOpacity, Dimensions, type AlertButton } from 'react-native';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, setAuthToken } from '../../api/client';
import { createRidesSocket } from '../../api/socket';
import { loadAuth, clearAuth } from '../../storage/authStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverHome'>;

interface RideOffer {
  id: string;
  fromAddress: string;
  toAddress: string;
  comment?: string;
  stops?: Array<{
    address: string;
    lat: number;
    lng: number;
  }>;
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
    // If going online, update state only after successful API call
    if (value) {
      try {
        await apiClient.post('/drivers/status', { isOnline: value });
        setIsOnline(true);
        // Refresh profile when going online
        const res = await apiClient.get('/drivers/profile');
        setProfile(res.data);
      } catch (e: any) {
        let errorMessage = e?.response?.data?.message || 'Не удалось выйти на линию';
        
        // Convert technical errors to user-friendly messages with actions
        if (errorMessage.includes('не одобрен администратором')) {
          errorMessage = '⏳ Ваш аккаунт ожидает подтверждения администратора. Это может занять до 24 часов.';
        } else if (errorMessage.includes('автомобиле')) {
          errorMessage = '🚗 Необходимо заполнить информацию об автомобиле.\n\nПерейдите в «Профиль» → «Мой автомобиль» и добавьте марку, модель, цвет и номер.';
        } else if (errorMessage.includes('водительского удостоверения')) {
          errorMessage = '📄 Необходимо загрузить водительское удостоверение.\n\nПерейдите в «Профиль» → «Документы» и загрузите фото прав.';
        } else if (errorMessage.includes('СТС')) {
          errorMessage = '📄 Необходимо загрузить СТС.\n\nПерейдите в «Профиль» → «Документы» и загрузите свидетельство о регистрации ТС.';
        }
        
        const buttons: AlertButton[] = [{ text: 'Понятно', style: 'default' }];
        if (errorMessage.includes('Профиль')) {
          buttons.push({ text: 'Открыть профиль', onPress: () => navigation.navigate('DriverProfile') });
        }
        
        Alert.alert('Невозможно выйти на линию', errorMessage, buttons);
        
        // Keep offline state
        setIsOnline(false);
      }
    } else {
      // Going offline is always allowed
      setIsOnline(false);
      try {
        await apiClient.post('/drivers/status', { isOnline: false });
      } catch {
        // ignore errors when going offline
      }
    }
  };

  const handleLogout = async () => {
    // If driver is online, set offline before logout
    if (isOnline) {
      try {
        await apiClient.post('/drivers/status', { isOnline: false });
      } catch {
        // ignore error, continue logout
      }
    }
    await clearAuth();
    setAuthToken(null);
    navigation.replace('Login');
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

socket.on('connect', () => {
  console.log('✅ Водитель успешно подключился к сокетам!');
});

socket.on('connect_error', (err: any) => {
  console.log('❌ Ошибка подключения сокетов у водителя:', err.message);
});

        socket = createRidesSocket(auth.token);
        
        // Handle ride offers
        socket.on('ride:offer', (ride: RideOffer) => {
          if (!isMounted) return;
          
          // Calculate distance (simplified)
          const distance = '—';
          const price = ride.estimatedPrice ? Math.round(ride.estimatedPrice) : '—';
          
          // Build message with comment and stops
          let message = `От: ${ride.fromAddress}\nДо: ${ride.toAddress}`;
          
          // Add stops if any
          if (ride.stops && ride.stops.length > 0) {
            message += '\n\nОстановки:';
            ride.stops.forEach((stop, index) => {
              message += `\n${index + 1}. ${stop.address}`;
            });
          }
          
          // Add comment if any
          if (ride.comment) {
            message += `\n\nКомментарий: ${ride.comment}`;
          }
          
          message += `\n\nЦена: ${price} ₽`;
          
          Alert.alert(
            'Новый заказ',
            message,
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
      {/* Full screen map as background */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>Карта доступна при поездке</Text>
        </View>
      </View>

      {/* Floating Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.handleBar} />

        {/* Profile Card */}
        {profile && (
          <View style={styles.profileCard}>
            <View style={styles.profileRow}>
              <View style={styles.balanceSection}>
                <Text style={styles.balanceLabel}>Баланс</Text>
                <Text style={styles.balanceValue}>{profile.balance ?? 0} ₽</Text>
              </View>
              <View style={styles.ratingSection}>
                <Text style={styles.ratingLabel}>Рейтинг</Text>
                <Text style={styles.ratingValue}>{(profile.rating ?? 5).toFixed(1)} ⭐</Text>
              </View>
            </View>
          </View>
        )}

        {/* Online Switch */}
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Рабочий режим</Text>
            <Text style={styles.switchSubtext}>
              {isOnline ? 'Онлайн — получение заказов' : 'Офлайн — отдых'}
            </Text>
          </View>
          <View style={[styles.switchContainer, isOnline && styles.switchContainerActive]}>
            <Switch
              value={isOnline}
              onValueChange={toggleOnline}
              trackColor={{ false: '#475569', true: '#3B82F6' }}
              thumbColor={isOnline ? '#F8FAFC' : '#94A3B8'}
            />
          </View>
        </View>

        {/* Status Display */}
        <View style={styles.statusCard}>
          <View style={[styles.statusDot, currentRideId ? styles.statusDotActive : styles.statusDotIdle]} />
          <Text style={styles.statusText}>
            {currentRideId ? 'Есть активный заказ' : 'Ожидание заказов...'}
          </Text>
        </View>

        {/* Profile Button */}
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('DriverProfile')}
        >
          <Text style={styles.profileButtonText}>👤 Мой профиль</Text>
        </TouchableOpacity>

        {/* Primary Action Button */}
        {currentRideId ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('DriverRide', { rideId: currentRideId })}
          >
            <Text style={styles.primaryButtonText}>Перейти к поездке</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('RideHistory')}
          >
            <Text style={styles.secondaryButtonText}>История поездок</Text>
          </TouchableOpacity>
        )}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Выйти из аккаунта</Text>
        </TouchableOpacity>
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
    backgroundColor: '#0F172A',
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
    minHeight: height * 0.45,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#475569',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  // Profile Card
  profileCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  balanceSection: {
    alignItems: 'center',
  },
  balanceLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceValue: {
    color: '#10B981',
    fontSize: 24,
    fontWeight: '700',
  },
  ratingSection: {
    alignItems: 'center',
  },
  ratingLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  ratingValue: {
    color: '#F59E0B',
    fontSize: 24,
    fontWeight: '700',
  },
  // Online Switch
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  switchLabel: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  switchSubtext: {
    color: '#94A3B8',
    fontSize: 13,
  },
  switchContainer: {
    transform: [{ scale: 1.1 }],
  },
  switchContainerActive: {
    // Active state styling if needed
  },
  // Status Card
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    shadowOpacity: 0.8,
  },
  statusDotIdle: {
    backgroundColor: '#64748B',
  },
  statusText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '500',
  },
  // Profile Button
  profileButton: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  profileButtonText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  // Buttons
  primaryButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#334155',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#7F1D1D',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#991B1B',
  },
  logoutButtonText: {
    color: '#FCA5A5',
    fontSize: 16,
    fontWeight: '600',
  },
});

