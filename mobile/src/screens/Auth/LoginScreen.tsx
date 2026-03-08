import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, setAuthToken } from '../../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/login', { phone, password });
      const { accessToken, user } = response.data;
      setAuthToken(accessToken);

      if (user.role === 'DRIVER') {
        navigation.replace('DriverHome');
      } else {
        navigation.replace('PassengerHome');
      }
    } catch (e) {
      setError('Не удалось войти. Проверьте данные.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TaxiVillage</Text>
      <TextInput
        style={styles.input}
        placeholder="Телефон"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title={loading ? 'Вход...' : 'Войти'} onPress={handleLogin} disabled={loading} />
      <View style={styles.linkRow}>
        <Text>Нет аккаунта?</Text>
        <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
          Зарегистрироваться
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
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
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  link: {
    marginLeft: 4,
    color: '#007AFF',
  },
});

