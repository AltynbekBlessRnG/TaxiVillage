import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, setAuthToken } from '../../api/client';
import { saveAuth } from '../../storage/authStorage';
import { registerPushToken } from '../../utils/notifications';
import { AuthScreenLayout } from '../../components/AuthScreenLayout';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'phone' | 'password' | null>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const reviewPhones = String(process.env.EXPO_PUBLIC_APP_REVIEW_PHONES || '')
        .split(',')
        .map((value) => value.replace(/\D/g, ''))
        .filter(Boolean);
      const normalizedPhone = phone.replace(/\D/g, '');

      if (reviewPhones.includes(normalizedPhone)) {
        const response = await apiClient.post('/auth/review-login', { phone, password });
        const { accessToken, refreshToken, user } = response.data;
        setAuthToken(accessToken);
        await saveAuth({
          accessToken,
          refreshToken,
          role: user.role,
          userId: user.id,
        });
        await registerPushToken().catch(() => null);

        const routeName = ['DRIVER', 'DRIVER_TAXI', 'COURIER', 'DRIVER_INTERCITY'].includes(
          user.role,
        )
          ? 'DriverHome'
          : user.role === 'MERCHANT'
            ? 'MerchantDashboard'
            : 'PassengerHome';
        navigation.reset({
          index: 0,
          routes:
            routeName === 'PassengerHome'
              ? [{ name: 'PassengerHome', params: {} }]
              : [{ name: routeName }],
        });
        return;
      }

      const response = await apiClient.post('/auth/login/start', { phone, password });
      navigation.navigate('VerifyPhone', {
        flow: 'LOGIN',
        sessionId: response.data.sessionId,
        phone,
        telegramBotUrl: response.data.telegramBotUrl ?? null,
        debugCode: response.data.debugCode,
      });
    } catch (e: any) {
      const errorMessage =
        e?.response?.data?.message || e?.message || 'Не удалось подключиться к серверу';
      setError(`Ошибка: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenLayout>
      <View style={styles.hero}>
        <Text style={styles.title}>Вход в аккаунт</Text>
        <Text style={styles.subtitle}>Введите номер телефона и пароль.</Text>
      </View>

      <View style={styles.formCard}>
        <TextInput
          style={[styles.input, focusedField === 'phone' && styles.inputFocused]}
          placeholder="Телефон"
          placeholderTextColor="#71717A"
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="next"
          blurOnSubmit={false}
          value={phone}
          onChangeText={setPhone}
          onSubmitEditing={() => passwordInputRef.current?.focus()}
          onFocus={() => setFocusedField('phone')}
          onBlur={() => setFocusedField((current) => (current === 'phone' ? null : current))}
        />
        <TextInput
          ref={passwordInputRef}
          style={[styles.input, focusedField === 'password' && styles.inputFocused]}
          placeholder="Пароль"
          placeholderTextColor="#71717A"
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="done"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
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
    </AuthScreenLayout>
  );
};

const styles = StyleSheet.create({
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
