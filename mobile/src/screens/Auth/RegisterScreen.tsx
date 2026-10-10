import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { AuthScreenLayout } from '../../components/AuthScreenLayout';
import { formatPhoneInput, isCompletePhone, toE164 } from '../../utils/phone';
import { extractApiError } from '../../utils/apiError';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;
type FieldName = 'fullName' | 'phone' | 'password' | null;

const MIN_PASSWORD_LENGTH = 6;

const ROLES = [
  { value: 'PASSENGER', label: 'Пассажир' },
  { value: 'DRIVER', label: 'Водитель или курьер' },
  { value: 'MERCHANT', label: 'Заведение' },
] as const;

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'PASSENGER' | 'DRIVER' | 'MERCHANT'>('PASSENGER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<FieldName>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const canSubmit =
    fullName.trim().length > 0 &&
    isCompletePhone(phone) &&
    password.length >= MIN_PASSWORD_LENGTH;

  const handleRegister = async () => {
    if (!fullName.trim()) {
      setError('Укажите имя');
      return;
    }
    if (!isCompletePhone(phone)) {
      setError('Введите номер полностью: +7 700 000 00 00');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const e164Phone = toE164(phone);
      const response = await apiClient.post('/auth/register/start', {
        phone: e164Phone,
        password,
        fullName: fullName.trim(),
        role,
      });
      navigation.navigate('VerifyPhone', {
        flow: 'REGISTER',
        sessionId: response.data.sessionId,
        phone: e164Phone,
        telegramBotUrl: response.data.telegramBotUrl ?? null,
        debugCode: response.data.debugCode,
      });
    } catch (e: any) {
      const raw = String(e?.response?.data?.message ?? '');
      if (e?.response?.status === 409 || raw.includes('Unique constraint')) {
        setError('Аккаунт с таким номером уже есть. Попробуйте войти.');
      } else {
        setError(extractApiError(e, 'Не удалось создать аккаунт. Попробуйте ещё раз.'));
      }
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
        <View style={styles.roleList}>
          {ROLES.map((item) => {
            const selected = role === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                style={[styles.roleRow, selected && styles.roleRowActive]}
                onPress={() => setRole(item.value)}
                activeOpacity={0.8}
              >
                <View style={[styles.radio, selected && styles.radioActive]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
                <Text style={[styles.roleLabel, selected && styles.roleLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          style={[styles.input, focusedField === 'fullName' && styles.inputFocused]}
          placeholder="Имя и фамилия"
          placeholderTextColor={colors.textTertiary}
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
          placeholder="+7 700 000 00 00"
          placeholderTextColor={colors.textTertiary}
          keyboardType="phone-pad"
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
            style={styles.passwordInput}
            placeholder={`Пароль, минимум ${MIN_PASSWORD_LENGTH} символов`}
            placeholderTextColor={colors.textTertiary}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleRegister}
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

        <Text style={styles.helperText}>
          Номер подтверждается через Telegram — он должен быть привязан к вашему аккаунту.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, (!canSubmit || loading) && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading || !canSubmit}
        >
          <Text style={styles.buttonText}>{loading ? 'Создание...' : 'Создать аккаунт'}</Text>
        </TouchableOpacity>

        {role === 'DRIVER' ? (
          <Text style={styles.helperText}>
            Курьер и межгород включаются внутри этого же аккаунта — на экране профиля.
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
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 14,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textTertiary,
    fontSize: 15,
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: colors.bg,
  },
  roleList: {
    gap: 8,
    marginBottom: 18,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  roleRowActive: {
    borderColor: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.text,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceInverse,
  },
  roleLabel: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  roleLabelActive: {
    color: colors.text,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingLeft: 18,
    paddingRight: 8,
    marginBottom: 14,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 16,
    color: colors.text,
    fontSize: 16,
  },
  revealButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  revealText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 14,
    color: colors.text,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: colors.info,
  },
  error: {
    color: colors.dangerTextStrong,
    marginBottom: 14,
    fontSize: 14,
  },
  helperText: {
    color: colors.textTertiary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
    marginBottom: 14,
  },
  button: {
    backgroundColor: colors.surfaceInverse,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: {
    color: colors.textInverse,
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
    color: colors.textTertiary,
    fontSize: 15,
  },
  link: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
