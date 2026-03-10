import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Switch } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createRidesSocket } from '../../api/socket';
import { loadAuth } from '../../storage/authStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverHome'>;

export const DriverHomeScreen: React.FC<Props> = ({ navigation }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);

  const toggleOnline = async (value: boolean) => {
    setIsOnline(value);
    try {
      await apiClient.post('/drivers/status', { isOnline: value });
    } catch {
      // ignore in MVP
    }
  };

  useEffect(() => {
    if (!isOnline) {
      setCurrentRideId(null);
      return;
    }

    let socket: ReturnType<typeof createRidesSocket> | null = null;
    let isMounted = true;

    const init = async () => {
      try {
        const auth = await loadAuth();
        if (!isMounted || !auth?.token) return;

        const res = await apiClient.get('/drivers/current-ride');
        if (isMounted && res.data?.id) {
          setCurrentRideId(res.data.id);
        }

        socket = createRidesSocket(auth.token);
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
      } catch {
        // ignore
      }
    };

    init();
    return () => {
      isMounted = false;
      socket?.disconnect();
    };
  }, [isOnline]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Режим водителя</Text>
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

