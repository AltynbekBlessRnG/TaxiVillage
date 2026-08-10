import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { AuthScreenLayout } from '../../components/AuthScreenLayout';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;
type FieldName = 'fullName' | 'phone' | 'password' | null;

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'PASSENGER' | 'DRIVER' | 'MERCHANT'>('PASSENGER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<FieldName>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const handleRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/register/start', {
        phone,
        password,
        fullName,
        role,
      });
      navigation.navigate('VerifyPhone', {
        flow: 'REGISTER',
        sessionId: response.data.sessionId,
        phone,
        telegramBotUrl: response.data.telegramBotUrl ?? null,
        debugCode: response.data.debugCode,
      });
    } catch (e: any) {
      let errorMessage =
        e?.response?.data?.message || e?.message || 'Не удалось подключиться к серверу';

      if (e?.response?.status === 500 && errorMessage.includes('Unique constraint')) {
        errorMessage = 'Пользователь с таким номером телефона уже существует. Попробуйте войти.';
      }

      setError(`Ошибка: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenLayout>
      <View style={styles.hero}>
        <Text style={styles.title}>Создать аккаунт</Text>
        <Text style={styles.subtitle}>Выберите роль и заполните данные.</Text>
      </View>

      <View style={styles.formCard}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentButton, role === 'PASSENGER' && styles.segmentButtonActive]}
            onPress={() => setRole('PASSENGER')}
          >
            <Text style={[styles.segmentText, role === 'PASSENGER' && styles.segmentTextActive]}>
              Пассажир
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, role === 'DRIVER' && styles.segmentButtonActive]}
            onPress={() => setRole('DRIVER')}
          >
            <Text style={[styles.segmentText, role === 'DRIVER' && styles.segmentTextActive]}>
              Водитель/курьер
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, role === 'MERCHANT' && styles.segmentButtonActive]}
            onPress={() => setRole('MERCHANT')}
          >
            <Text style={[styles.segmentText, role === 'MERCHANT' && styles.segmentTextActive]}>
              Заведение
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.input, focusedField === 'fullName' && styles.inputFocused]}
          placeholder="ФИО"
          placeholderTextColor="#71717A"
          value={fullName}
          onChangeText={setFullName}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => phoneInputRef.current?.focus()}
          onFocus={() => setFocusedField('fullName')}
          onBlur={() => setFocusedField((current) => (current === 'fullName' ? null : current))}
        />
        <TextInput
          ref={phoneInputRef}
          style={[styles.input, focusedField === 'phone' && styles.inputFocused]}
          placeholder="Телефон"
          placeholderTextColor="#71717A"
          keyboardType="phone-pad"
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
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleRegister}
          onFocus={() => setFocusedField('password')}
          onBlur={() => setFocusedField((current) => (current === 'password' ? null : current))}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Создание...' : 'Создать аккаунт'}</Text>
        </TouchableOpacity>

        {role === 'DRIVER' ? (
          <Text style={styles.helperText}>
            Курьер и межгород теперь включаются внутри одного аккаунта водителя на экране профиля.
          </Text>
        ) : null}

        <View style={styles.linkRow}>
          <Text style={styles.linkText}>Уже есть аккаунт?</Text>
          <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
            Войти
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
  segmentedControl: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 6,
    gap: 6,
    marginBottom: 18,
  },
  segmentButton: {
    width: '48%',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#27272A',
  },
  segmentText: {
    color: '#71717A',
    fontSize: 15,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#F4F4F5',
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
  helperText: {
    color: '#71717A',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
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
