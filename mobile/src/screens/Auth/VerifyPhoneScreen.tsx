import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, setAuthToken } from '../../api/client';
import { saveAuth } from '../../storage/authStorage';
import { registerPushToken } from '../../utils/notifications';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyPhone'>;

function routeAfterAuth(role: string) {
  if (role === 'DRIVER' || role === 'DRIVER_TAXI' || role === 'COURIER' || role === 'DRIVER_INTERCITY') {
    return 'DriverHome' as const;
  }
  if (role === 'MERCHANT') {
    return 'MerchantDashboard' as const;
  }
  return 'PassengerHome' as const;
}

export const VerifyPhoneScreen: React.FC<Props> = ({ navigation, route }) => {
  const { flow, sessionId, phone, telegramBotUrl, debugCode } = route.params;
  const [botUrl, setBotUrl] = useState<string | null>(telegramBotUrl);
  const [localDebugCode, setLocalDebugCode] = useState<string | undefined>(debugCode);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const title = useMemo(
    () => (flow === 'REGISTER' ? 'Подтверди номер' : 'Подтверди вход'),
    [flow],
  );

  const completePath = flow === 'REGISTER' ? '/auth/register/complete' : '/auth/login/complete';

  const finishAuth = useCallback(async (verificationToken: string) => {
    const completeResponse = await apiClient.post(completePath, {
      verificationToken,
    });

    const { accessToken, refreshToken, user } = completeResponse.data;
    setAuthToken(accessToken);
    await saveAuth({
      accessToken,
      refreshToken,
      role: user.role,
      userId: user.id,
    });
    await registerPushToken().catch(() => null);

    const nextRoute = routeAfterAuth(user.role);
    if (nextRoute === 'PassengerHome') {
      navigation.reset({
        index: 0,
        routes: [{ name: 'PassengerHome', params: {} }],
      });
      return;
    }

    navigation.reset({
      index: 0,
      routes: [{ name: nextRoute as 'DriverHome' | 'MerchantDashboard' }],
    });
  }, [completePath, navigation]);

  const checkVerificationStatus = async (silent = false) => {
    if (!silent) {
      setCheckingStatus(true);
      setError(null);
    }

    try {
      const statusResponse = await apiClient.post('/auth/verification-status', { sessionId });
      if (statusResponse.data?.verified && statusResponse.data?.verificationToken) {
        setSubmitting(true);
        await finishAuth(statusResponse.data.verificationToken);
        return;
      }

      if (!silent) {
        setError('Подтверждение из Telegram еще не получено. Нажми кнопку в боте и отправь свой номер.');
      }
    } catch (e: any) {
      if (!silent) {
        const message = e?.response?.data?.message || 'Не удалось проверить статус подтверждения';
        setError(Array.isArray(message) ? message.join(', ') : String(message));
      }
    } finally {
      if (!silent) {
        setCheckingStatus(false);
      }
      setSubmitting(false);
    }
  };

  useEffect(() => {
    let active = true;

    const timer = setInterval(() => {
      void (async () => {
        if (!active) {
          return;
        }

        try {
          const statusResponse = await apiClient.post('/auth/verification-status', { sessionId });
          if (statusResponse.data?.verified && statusResponse.data?.verificationToken) {
            active = false;
            setSubmitting(true);
            await finishAuth(statusResponse.data.verificationToken);
          }
        } catch {
          // Ignore polling errors and let the manual button show a visible error.
        } finally {
          if (active) {
            setSubmitting(false);
          }
        }
      })();
    }, 4000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [sessionId, finishAuth]);

  const handleComplete = async () => {
    setSubmitting(true);
    setError(null);
    await checkVerificationStatus();
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/otp/resend', { sessionId });
      if (!botUrl && response.data?.telegramBotUrl) {
        setBotUrl(response.data.telegramBotUrl);
      }
      if (response.data?.debugCode) {
        setLocalDebugCode(response.data.debugCode);
      }
    } catch (e: any) {
      const message = e?.response?.data?.message || 'Не удалось отправить запрос снова';
      setError(Array.isArray(message) ? message.join(', ') : String(message));
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>← Назад</Text>
          </TouchableOpacity>

          <View style={styles.hero}>
            <Text style={styles.eyebrow}>Подтверждение номера</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              Открой Telegram-бота, отправь свой контакт через кнопку Telegram и вернись сюда. Номер: {phone}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Что делать</Text>
            <Text style={styles.instructions}>1. Открой Telegram-бота.</Text>
            <Text style={styles.instructions}>2. Нажми кнопку отправки номера в Telegram.</Text>
            <Text style={styles.instructions}>3. Вернись сюда и нажми кнопку проверки подтверждения.</Text>

            {localDebugCode ? (
              <Text style={styles.debugText}>Тестовый код: {localDebugCode}</Text>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleComplete}
              disabled={submitting || checkingStatus}
            >
              <Text style={styles.primaryButtonText}>
                {submitting || checkingStatus ? 'Проверяем...' : 'Я подтвердил номер в Telegram'}
              </Text>
            </TouchableOpacity>

            {botUrl ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => Linking.openURL(botUrl).catch(() => null)}
              >
                <Text style={styles.secondaryButtonText}>Открыть Telegram-бота</Text>
              </TouchableOpacity>
            ) : null}

            <Pressable onPress={handleResend} disabled={resending}>
              <Text style={styles.linkText}>
                {resending ? 'Отправляем запрос снова...' : 'Отправить запрос в Telegram еще раз'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 24,
  },
  backButtonText: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '700',
  },
  hero: {
    marginBottom: 28,
  },
  eyebrow: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#F4F4F5',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    color: '#A1A1AA',
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 24,
    padding: 18,
  },
  label: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  instructions: {
    color: '#D4D4D8',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  debugText: {
    color: '#FCD34D',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 10,
    fontWeight: '700',
  },
  error: {
    color: '#F87171',
    fontSize: 14,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#F4F4F5',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#09090B',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
  },
  linkText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
  },
});
