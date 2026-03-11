import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, setAuthToken } from '../../api/client';
import { saveAuth } from '../../storage/authStorage';

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
      await saveAuth(accessToken, user.role);

      if (user.role === 'DRIVER') {
        navigation.replace('DriverHome');
      } else {
        navigation.replace('PassengerHome');
      }
    } catch (e: any) {
      const errorMessage = e?.response?.data?.message || e?.message || 'Не удалось подключиться к серверу';
      setError(`Ошибка: ${errorMessage}`);
      console.log('Login error:', e);
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
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Вход...' : 'Войти'}</Text>
      </TouchableOpacity>
      <View style={styles.linkRow}>
        <Text style={styles.linkText}>Нет аккаунта?</Text>
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
    backgroundColor: '#0F172A',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
    color: '#3B82F6',
    textShadowColor: '#3B82F6',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    color: '#F8FAFC',
    fontSize: 16,
  },
  inputFocused: {
    borderColor: '#3B82F6',
  },
  error: {
    color: '#ef4444',
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  linkText: {
    color: '#94A3B8',
  },
  link: {
    marginLeft: 4,
    color: '#3B82F6',
    fontWeight: '600',
  },
});

