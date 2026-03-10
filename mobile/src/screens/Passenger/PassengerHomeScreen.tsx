import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'PassengerHome'>;

export const PassengerHomeScreen: React.FC<Props> = ({ navigation }) => {
  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRide = async () => {
    setLoading(true);
    setError(null);
    try {
      let fromLat: number | undefined;
      let fromLng: number | undefined;
      let toLat: number | undefined;
      let toLng: number | undefined;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          fromLat = loc.coords.latitude;
          fromLng = loc.coords.longitude;
        }
      } catch {
        // игнорируем ошибки геолокации
      }

      if (toAddress.trim()) {
        try {
          const results = await Location.geocodeAsync(toAddress);
          if (results.length > 0) {
            toLat = results[0].latitude;
            toLng = results[0].longitude;
          }
        } catch {
          // игнорируем ошибки геокодинга
        }
      }

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
      <Text style={styles.title}>Новая поездка</Text>
      <TextInput
        style={styles.input}
        placeholder="Откуда"
        value={fromAddress}
        onChangeText={setFromAddress}
      />
      <TextInput
        style={styles.input}
        placeholder="Куда"
        value={toAddress}
        onChangeText={setToAddress}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title={loading ? 'Создание...' : 'Заказать'} onPress={createRide} disabled={loading} />
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
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  error: {
    color: 'red',
    marginBottom: 8,
  },
});

