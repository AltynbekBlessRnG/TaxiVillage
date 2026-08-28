import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, setAuthToken } from '../../api/client';
import { saveAuth } from '../../storage/authStorage';
import { registerPushToken } from '../../utils/notifications';
import { extractApiError } from '../../utils/apiError';

/** Matches the backend rate limit of 5 resend requests per minute. */
const RESEND_COOLDOWN_SECONDS = 30;

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
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = setTimeout(() => setResendCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

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
    // Not awaited, for the same reason as on the login screen: the
    // permission dialog and Expo's token service must not hold up entry.
    void registerPushToken().catch(() => null);

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
        setError(
          'Подтверждение пока не пришло. Откройте бота и нажмите там кнопку отправки номера.',
        );
      }
    } catch (e: any) {
      if (!silent) {
        setError(extractApiError(e, 'Не удалось проверить статус подтверждения'));
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
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e: any) {
      setError(extractApiError(e, 'Не удалось отправить запрос снова'));
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
              Откройте бота в Telegram и нажмите там кнопку «Отправить номер». Мы поймём это
              автоматически и продолжим сами.
            </Text>
            <Text style={styles.phoneValue}>{phone}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Что нужно сделать</Text>
            <Text style={styles.instructions}>1. Откройте бота кнопкой ниже.</Text>
            <Text style={styles.instructions}>2. Нажмите в Telegram кнопку отправки номера.</Text>
            <Text style={styles.instructions}>3. Вернитесь в приложение — вход произойдёт сам.</Text>

            {localDebugCode ? (
              <Text style={styles.debugText}>Тестовый код: {localDebugCode}</Text>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {botUrl ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => Linking.openURL(botUrl).catch(() => null)}
              >
                <Text style={styles.primaryButtonText}>Открыть Telegram</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.waitingRow}>
              <ActivityIndicator size="small" color="#71717A" />
              <Text style={styles.waitingText}>
                {submitting || checkingStatus
                  ? 'Проверяем подтверждение...'
                  : 'Ждём подтверждения из Telegram'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleComplete}
              disabled={submitting || checkingStatus}
            >
              <Text style={styles.secondaryButtonText}>Проверить сейчас</Text>
            </TouchableOpacity>

            <Pressable onPress={handleResend} disabled={resending || resendCooldown > 0}>
              <Text style={styles.linkText}>
                {resending
                  ? 'Отправляем запрос...'
                  : resendCooldown > 0
                    ? `Отправить запрос ещё раз через ${resendCooldown} с`
                    : 'Отправить запрос в Telegram ещё раз'}
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
  phoneValue: {
    color: '#F4F4F5',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 12,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
  },
  waitingText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '600',
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
