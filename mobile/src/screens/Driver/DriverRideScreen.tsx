import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverRide'>;

export const DriverRideScreen: React.FC<Props> = ({ route, navigation }) => {
  const { rideId } = route.params;
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await apiClient.get(`/rides/${rideId}`);
        setStatus(response.data.status);
      } catch {
        // ignore
      }
    };
    fetchStatus();
  }, [rideId]);

  const updateStatus = async (newStatus: string) => {
    try {
      await apiClient.post(`/rides/${rideId}/status`, { status: newStatus });
      setStatus(newStatus);
      if (newStatus === 'COMPLETED') {
        navigation.replace('DriverHome');
      }
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Текущая поездка</Text>
      <Text style={styles.status}>Статус: {status}</Text>
      <Button title="Еду к клиенту" onPress={() => updateStatus('ON_THE_WAY')} />
      <Button title="Везу клиента" onPress={() => updateStatus('IN_PROGRESS')} />
      <Button title="Завершить поездку" onPress={() => updateStatus('COMPLETED')} />
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
  status: {
    fontSize: 16,
    marginBottom: 16,
  },
});

