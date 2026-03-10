import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createRidesSocket } from '../../api/socket';
import { loadAuth } from '../../storage/authStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'RideStatus'>;

function applyRideToState(
  ride: {
    status?: string;
    driver?: { fullName?: string; car?: { plateNumber?: string } };
    finalPrice?: number | string;
    estimatedPrice?: number | string;
  },
  setStatus: (s: string) => void,
  setDriverInfo: (s: string | null) => void,
  setPriceInfo: (s: string | null) => void,
) {
  if (ride.status) setStatus(ride.status);
  if (ride.driver) {
    setDriverInfo(`${ride.driver.fullName || 'Водитель'} • ${ride.driver.car?.plateNumber ?? ''}`);
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

  useEffect(() => {
    let socket: ReturnType<typeof createRidesSocket> | null = null;
    let isMounted = true;

    const init = async () => {
      try {
        const response = await apiClient.get(`/rides/${rideId}`);
        if (!isMounted) return;
        applyRideToState(response.data, setStatus, setDriverInfo, setPriceInfo);

        const auth = await loadAuth();
        if (!isMounted || !auth?.token) return;

        socket = createRidesSocket(auth.token);
        socket.on('ride:updated', (ride: { id: string }) => {
          if (isMounted && ride.id === rideId) {
            applyRideToState(ride, setStatus, setDriverInfo, setPriceInfo);
          }
        });
        socket.on('ride:created', (ride: { id: string }) => {
          if (isMounted && ride.id === rideId) {
            applyRideToState(ride, setStatus, setDriverInfo, setPriceInfo);
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

  const canCancel = status === 'SEARCHING_DRIVER' || status === 'DRIVER_ASSIGNED';

  const handleCancel = async () => {
    try {
      await apiClient.post(`/rides/${rideId}/cancel`);
      navigation.replace('PassengerHome');
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Статус поездки</Text>
      <Text style={styles.status}>{status}</Text>
      {driverInfo && <Text style={styles.driver}>{driverInfo}</Text>}
      {priceInfo && <Text style={styles.price}>{priceInfo}</Text>}
      {canCancel && (
        <Button title="Отменить поездку" onPress={handleCancel} color="#c00" />
      )}
      <Button title="На главный экран" onPress={() => navigation.replace('PassengerHome')} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
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
});

