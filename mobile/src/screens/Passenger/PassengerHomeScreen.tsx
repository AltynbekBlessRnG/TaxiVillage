import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
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
      // В MVP координаты и тариф упрощены.
      const response = await apiClient.post('/rides', {
        fromAddress,
        toAddress,
      });
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

