import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
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
      const { accessToken, refreshToken, user } = response.data;
      setAuthToken(accessToken);
      await saveAuth({
        accessToken,
        refreshToken,
        role: user.role,
        userId: user.id,
      });
      if (user.role === 'DRIVER') {
        navigation.replace('DriverHome');
      } else {
        navigation.replace('PassengerHome', {});
      }
    } catch (e: any) {
      let errorMessage = e?.response?.data?.message || e?.message || 'Не удалось подключиться к серверу';
      
      // Обработка специфичных ошибок
      if (e?.response?.status === 500 && errorMessage.includes('Unique constraint')) {
        errorMessage = 'Пользователь с таким номером телефона уже существует. Попробуйте войти.';
      }
      
      setError(`Ошибка: ${errorMessage}`);
      console.log('Register error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Создать аккаунт</Text>
      <TextInput
        style={styles.input}
        placeholder="ФИО"
        placeholderTextColor="#64748B"
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        style={styles.input}
        placeholder="Телефон"
        placeholderTextColor="#64748B"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        placeholderTextColor="#64748B"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <View style={styles.roleRow}>
        <Text style={styles.roleLabel}>Роль:</Text>
        <TouchableOpacity
          style={[styles.roleOption, role === 'PASSENGER' && styles.roleOptionActive]}
          onPress={() => setRole('PASSENGER')}
        >
          <Text style={[styles.roleText, role === 'PASSENGER' && styles.roleTextActive]}>
            Пассажир
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roleOption, role === 'DRIVER' && styles.roleOptionActive]}
          onPress={() => setRole('DRIVER')}
        >
          <Text style={[styles.roleText, role === 'DRIVER' && styles.roleTextActive]}>
            Водитель
          </Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Создание...' : 'Создать аккаунт'}
        </Text>
      </TouchableOpacity>
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
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
    color: '#3B82F6',
    textShadowColor: 'rgba(59, 130, 246, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    fontSize: 16,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  roleLabel: {
    marginRight: 12,
    color: '#94A3B8',
    fontSize: 14,
  },
  roleOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
    backgroundColor: '#0F172A',
  },
  roleOptionActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  roleText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  roleTextActive: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  error: {
    color: '#EF4444',
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
});

