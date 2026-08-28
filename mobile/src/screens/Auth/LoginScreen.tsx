import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, setAuthToken } from '../../api/client';
import { saveAuth } from '../../storage/authStorage';
import { registerPushToken } from '../../utils/notifications';
import { AuthScreenLayout } from '../../components/AuthScreenLayout';
import { formatPhoneInput, isCompletePhone, toE164 } from '../../utils/phone';
import { extractApiError } from '../../utils/apiError';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'phone' | 'password' | null>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const canSubmit = isCompletePhone(phone) && password.length > 0;

  const handleLogin = async () => {
    if (!isCompletePhone(phone)) {
      setError('Введите номер полностью: +7 700 000 00 00');
      return;
    }
    if (!password) {
      setError('Введите пароль');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const e164Phone = toE164(phone);
      const reviewPhones = String(process.env.EXPO_PUBLIC_APP_REVIEW_PHONES || '')
        .split(',')
        .map((value) => value.replace(/\D/g, ''))
        .filter(Boolean);
      const normalizedPhone = e164Phone.replace(/\D/g, '');

      if (reviewPhones.includes(normalizedPhone)) {
        const response = await apiClient.post('/auth/review-login', {
          phone: e164Phone,
          password,
        });
        const { accessToken, refreshToken, user } = response.data;
        setAuthToken(accessToken);
        await saveAuth({
          accessToken,
          refreshToken,
          role: user.role,
          userId: user.id,
        });
        // Not awaited: this asks for the notification permission and then
        // talks to Expo's token service, so awaiting it left the button on
        // "Вход..." until the person answered a dialog they had not asked
        // for — and forever if the service was slow. The navigator registers
        // the token on its own once the session exists.
        void registerPushToken().catch(() => null);

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

      const response = await apiClient.post('/auth/login/start', {
        phone: e164Phone,
        password,
      });
      navigation.navigate('VerifyPhone', {
        flow: 'LOGIN',
        sessionId: response.data.sessionId,
        phone: e164Phone,
        telegramBotUrl: response.data.telegramBotUrl ?? null,
        debugCode: response.data.debugCode,
      });
    } catch (e: any) {
      if (e?.response?.status === 401) {
        setError('Неверный номер телефона или пароль');
      } else {
        setError(extractApiError(e, 'Не удалось войти. Попробуйте ещё раз.'));
      }
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
          // Named so the screenshot workflow can drive this form on a simulator.
          testID="login-phone"
          style={[styles.input, focusedField === 'phone' && styles.inputFocused]}
          placeholder="+7 700 000 00 00"
          placeholderTextColor="#71717A"
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="next"
          blurOnSubmit={false}
          value={phone}
          onChangeText={(text) => setPhone(formatPhoneInput(text))}
          onSubmitEditing={() => passwordInputRef.current?.focus()}
          onFocus={() => setFocusedField('phone')}
          onBlur={() => setFocusedField((current) => (current === 'phone' ? null : current))}
        />
        <View
          style={[
            styles.passwordWrapper,
            focusedField === 'password' && styles.inputFocused,
          ]}
        >
          <TextInput
            ref={passwordInputRef}
            testID="login-password"
            style={styles.passwordInput}
            placeholder="Пароль"
            placeholderTextColor="#71717A"
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleLogin}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField((current) => (current === 'password' ? null : current))}
          />
          <TouchableOpacity
            style={styles.revealButton}
            onPress={() => setShowPassword((value) => !value)}
            hitSlop={8}
          >
            <Text style={styles.revealText}>{showPassword ? 'Скрыть' : 'Показать'}</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          testID="login-submit"
          style={[styles.button, (!canSubmit || loading) && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading || !canSubmit}
        >
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
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    paddingLeft: 18,
    paddingRight: 8,
    marginBottom: 14,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 16,
    color: '#F4F4F5',
    fontSize: 16,
  },
  revealButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  revealText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
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
  buttonDisabled: {
    opacity: 0.45,
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
