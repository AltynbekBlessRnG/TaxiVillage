import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, setAuthToken } from '../../api/client';
import { saveAuth } from '../../storage/authStorage';
import { registerPushToken } from '../../utils/notifications';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'phone' | 'password' | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/login', { phone, password });
      const { accessToken, refreshToken, user } = response.data;
      setAuthToken(accessToken);
      await saveAuth({
        accessToken,
        refreshToken,
        role: user.role,
        userId: user.id,
      });
      await registerPushToken().catch(() => null);

      if (user.role === 'DRIVER' || user.role === 'DRIVER_TAXI') {
        navigation.replace('DriverHome');
      } else if (user.role === 'COURIER') {
        navigation.replace('DriverHome');
      } else if (user.role === 'MERCHANT') {
        navigation.replace('MerchantDashboard');
      } else if (user.role === 'DRIVER_INTERCITY') {
        navigation.replace('DriverHome');
      } else {
        navigation.replace('PassengerHome', {});
      }
    } catch (e: any) {
      const errorMessage =
        e?.response?.data?.message || e?.message || 'Не удалось подключиться к серверу';
      setError(`Ошибка: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable style={styles.content} onPress={() => setFocusedField(null)}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>TaxiVillage</Text>
          <Text style={styles.title}>Вход в аккаунт</Text>
          <Text style={styles.subtitle}>Продолжайте работу в приложении без лишнего шума.</Text>
        </View>

        <View style={styles.formCard}>
          <TextInput
            style={[styles.input, focusedField === 'phone' && styles.inputFocused]}
            placeholder="Телефон"
            placeholderTextColor="#71717A"
            keyboardType="phone-pad"
            autoCapitalize="none"
            value={phone}
            onChangeText={setPhone}
            onFocus={() => setFocusedField('phone')}
            onBlur={() => setFocusedField((current) => (current === 'phone' ? null : current))}
          />
          <TextInput
            style={[styles.input, focusedField === 'password' && styles.inputFocused]}
            placeholder="Пароль"
            placeholderTextColor="#71717A"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField((current) => (current === 'password' ? null : current))}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

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
      </Pressable>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  hero: {
    marginBottom: 28,
  },
  eyebrow: {
    color: '#F4F4F5',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 14,
  },
  title: {
    color: '#F4F4F5',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#71717A',
    fontSize: 15,
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: '#09090B',
  },
  input: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 14,
    color: '#F4F4F5',
    fontSize: 16,
  },
  inputFocused: {
    borderColor: '#3B82F6',
  },
  error: {
    color: '#EF4444',
    marginBottom: 14,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#F4F4F5',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '800',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 22,
    gap: 6,
  },
  linkText: {
    color: '#71717A',
    fontSize: 15,
  },
  link: {
    color: '#A1A1AA',
    fontSize: 15,
    fontWeight: '600',
  },
});
