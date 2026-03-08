import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'RideStatus'>;

export const RideStatusScreen: React.FC<Props> = ({ route, navigation }) => {
  const { rideId } = route.params;
  const [status, setStatus] = useState<string>('');
  const [driverInfo, setDriverInfo] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const response = await apiClient.get(`/rides/${rideId}`);
        if (!isMounted) return;
        const ride = response.data;
        setStatus(ride.status);
        if (ride.driver) {
          setDriverInfo(`${ride.driver.fullName || 'Водитель'} • ${ride.driver.car?.plateNumber ?? ''}`);
        }
      } catch {
        // ignore for MVP
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [rideId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Статус поездки</Text>
      <Text style={styles.status}>{status}</Text>
      {driverInfo && <Text style={styles.driver}>{driverInfo}</Text>}
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
    marginBottom: 16,
    textAlign: 'center',
  },
});

