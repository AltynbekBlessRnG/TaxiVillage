import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, setAuthToken } from '../../api/client';
import { saveAuth } from '../../storage/authStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'PASSENGER' | 'DRIVER'>('PASSENGER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/register', {
        phone,
        password,
        fullName,
        role,
      });
      const { accessToken, user } = response.data;
      setAuthToken(accessToken);
      await saveAuth(accessToken, user.role);
      if (user.role === 'DRIVER') {
        navigation.replace('DriverHome');
      } else {
        navigation.replace('PassengerHome');
      }
    } catch (e) {
      setError('Не удалось зарегистрироваться. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Регистрация</Text>
      <TextInput
        style={styles.input}
        placeholder="ФИО"
        value={fullName}
        onChangeText={setFullName}
      />
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

      <View style={styles.roleRow}>
        <Text style={styles.roleLabel}>Роль:</Text>
        <Text
          style={[styles.roleOption, role === 'PASSENGER' && styles.roleOptionActive]}
          onPress={() => setRole('PASSENGER')}
        >
          Пассажир
        </Text>
        <Text
          style={[styles.roleOption, role === 'DRIVER' && styles.roleOptionActive]}
          onPress={() => setRole('DRIVER')}
        >
          Водитель
        </Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      <Button title={loading ? 'Создание...' : 'Создать аккаунт'} onPress={handleRegister} disabled={loading} />
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
    fontSize: 24,
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
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleLabel: {
    marginRight: 12,
  },
  roleOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    marginRight: 8,
  },
  roleOptionActive: {
    backgroundColor: '#007AFF',
    color: '#fff',
    borderColor: '#007AFF',
  },
  error: {
    color: 'red',
    marginBottom: 8,
  },
});

