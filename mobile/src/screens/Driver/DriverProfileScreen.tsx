import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, logout } from '../../api/client';
import { DarkAlertModal } from '../../components/DarkAlertModal';
import { resolveApiAssetUrl } from '../../utils/assets';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverProfile'>;

interface Car {
  make?: string;
  model?: string;
  color?: string;
  plateNumber?: string;
}

interface Document {
  id: string;
  type: 'DRIVER_LICENSE' | 'CAR_REGISTRATION' | 'TAXI_LICENSE' | 'COURIER_ID' | 'OTHER';
  url: string;
  approved: boolean;
}

interface DriverProfileData {
  fullName?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  balance?: number;
  rating?: number;
  supportsTaxi?: boolean;
  supportsCourier?: boolean;
  supportsIntercity?: boolean;
  driverMode?: 'TAXI' | 'COURIER' | 'INTERCITY';
  courierTransportType?: 'CAR' | 'BIKE' | 'FOOT' | null;
  car?: Car;
  documents?: Document[];
  user?: { phone?: string; avatarUrl?: string | null };
}

const TRANSPORT_LABELS = {
  FOOT: 'Пеший',
  BIKE: 'Байк',
  CAR: 'Авто',
} as const;

const ReadinessCard: React.FC<{
  title: string;
  subtitle: string;
  ready: boolean;
  accent: string;
  steps: string[];
  badge: string;
}> = ({ title, subtitle, ready, accent, steps, badge }) => (
  <View
    style={[
      styles.readinessCard,
      ready ? styles.readinessCardReady : styles.readinessCardPending,
      { borderColor: ready ? '#27272A' : accent },
    ]}
  >
    {!ready ? <View style={[styles.readinessAccentBar, { backgroundColor: accent }]} /> : null}
    <View style={styles.readinessHeader}>
      <View style={styles.readinessCopy}>
        <Text style={styles.readinessTitle}>{title}</Text>
        <Text style={styles.readinessSubtitle}>{subtitle}</Text>
      </View>
      <View
        style={[
          styles.readinessBadge,
          ready
            ? { backgroundColor: accent, borderColor: accent }
            : { backgroundColor: `${accent}22`, borderColor: accent },
        ]}
      >
        <Text style={[styles.readinessBadgeText, ready && styles.readinessBadgeTextReady]}>
          {badge}
        </Text>
      </View>
    </View>
    {steps.length === 0 ? (
      <Text style={styles.readyText}>Можно выходить на линию.</Text>
    ) : (
      steps.map((step) => (
        <View key={`${title}-${step}`} style={styles.stepRow}>
          <Text style={styles.stepDot}>•</Text>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))
    )}
  </View>
);

const StatCard: React.FC<{ label: string; value: string; accent?: string }> = ({
  label,
  value,
  accent = '#F4F4F5',
}) => (
  <View style={styles.statCard}>
    <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const PillButton: React.FC<{
  title: string;
  active?: boolean;
  onPress: () => void;
  disabled?: boolean;
}> = ({ title, active = false, onPress, disabled = false }) => (
  <TouchableOpacity
    style={[styles.pillButton, active && styles.pillButtonActive, disabled && styles.disabledButton]}
    onPress={onPress}
    disabled={disabled}
  >
    <Text style={[styles.pillButtonText, active && styles.pillButtonTextActive]}>{title}</Text>
  </TouchableOpacity>
);

export const DriverProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [profile, setProfile] = useState<DriverProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [updatingIntercity, setUpdatingIntercity] = useState(false);
  const [updatingCourier, setUpdatingCourier] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [modal, setModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    primaryLabel?: string;
    secondaryLabel?: string;
    primaryVariant?: 'default' | 'danger';
    onPrimary?: (() => void | Promise<void>) | null;
    onSecondary?: (() => void | Promise<void>) | null;
  }>({
    visible: false,
    title: '',
    message: '',
  });
  const [courierTransportType, setCourierTransportType] = useState<'CAR' | 'BIKE' | 'FOOT'>('FOOT');

  const approvedDocuments = profile?.documents?.filter((doc) => doc.approved) ?? [];
  const hasApprovedLicense = approvedDocuments.some((doc) => doc.type === 'DRIVER_LICENSE');
  const hasApprovedRegistration = approvedDocuments.some((doc) => doc.type === 'CAR_REGISTRATION');
  const hasApprovedCourierId = approvedDocuments.some((doc) => doc.type === 'COURIER_ID');
  const hasCarInfo = !!(profile?.car?.make && profile?.car?.model && profile?.car?.color && profile?.car?.plateNumber);
  const courierNeedsVehicleDocs = courierTransportType !== 'FOOT';

  const taxiSteps = useMemo(
    () =>
      [
        profile?.status !== 'APPROVED' ? 'Нужно одобрение' : null,
        !hasCarInfo ? 'Заполните авто' : null,
        !hasApprovedLicense ? 'Загрузите права' : null,
        !hasApprovedRegistration ? 'Загрузите СТС' : null,
      ].filter(Boolean) as string[],
    [hasApprovedLicense, hasApprovedRegistration, hasCarInfo, profile?.status],
  );

  const courierSteps = useMemo(
    () =>
      [
        profile?.status !== 'APPROVED' ? 'Нужно одобрение' : null,
        !profile?.supportsCourier ? 'Включите курьера' : null,
        !hasApprovedCourierId ? 'Загрузите удостоверение' : null,
        courierNeedsVehicleDocs && !hasCarInfo ? 'Заполните авто' : null,
        courierNeedsVehicleDocs && !hasApprovedLicense ? 'Загрузите права' : null,
        courierNeedsVehicleDocs && !hasApprovedRegistration ? 'Загрузите СТС' : null,
      ].filter(Boolean) as string[],
    [
      courierNeedsVehicleDocs,
      hasApprovedCourierId,
      hasApprovedLicense,
      hasApprovedRegistration,
      hasCarInfo,
      profile?.status,
      profile?.supportsCourier,
    ],
  );

  const intercitySteps = useMemo(
    () =>
      [
        profile?.status !== 'APPROVED' ? 'Нужно одобрение' : null,
        !profile?.supportsIntercity ? 'Включите межгород' : null,
        !hasCarInfo ? 'Заполните авто' : null,
      ].filter(Boolean) as string[],
    [hasCarInfo, profile?.status, profile?.supportsIntercity],
  );

  const taxiReady = taxiSteps.length === 0;
  const courierReady = courierSteps.length === 0;
  const intercityReady = intercitySteps.length === 0;
  const urgentTasks = useMemo(() => {
    if (taxiSteps.length > 0) {
      return {
        title: 'Что нужно для такси',
        step: taxiSteps[0],
        accent: '#60A5FA',
      };
    }

    if (courierSteps.length > 0) {
      return {
        title: 'Что нужно для курьера',
        step: courierSteps[0],
        accent: '#F59E0B',
      };
    }

    if (intercitySteps.length > 0) {
      return {
        title: 'Что нужно для межгорода',
        step: intercitySteps[0],
        accent: '#38BDF8',
      };
    }

    return {
      title: 'Профиль готов',
      step: 'Все готово к работе.',
      accent: '#22C55E',
    };
  }, [courierSteps, intercitySteps, taxiSteps]);
  const readinessScore = useMemo(() => {
    const checks = [
      profile?.status === 'APPROVED',
      hasCarInfo,
      hasApprovedLicense,
      hasApprovedRegistration,
      profile?.supportsCourier ? hasApprovedCourierId : true,
      profile?.supportsCourier && courierNeedsVehicleDocs ? hasCarInfo : true,
      profile?.supportsCourier && courierNeedsVehicleDocs ? hasApprovedLicense : true,
      profile?.supportsCourier && courierNeedsVehicleDocs ? hasApprovedRegistration : true,
      profile?.supportsIntercity ? hasCarInfo : true,
    ];
    const passed = checks.filter(Boolean).length;
    return Math.round((passed / checks.length) * 100);
  }, [
    courierNeedsVehicleDocs,
    hasApprovedCourierId,
    hasApprovedLicense,
    hasApprovedRegistration,
    hasCarInfo,
    profile?.status,
    profile?.supportsCourier,
    profile?.supportsIntercity,
  ]);
  const avatarUri = useMemo(
    () => resolveApiAssetUrl(profile?.user?.avatarUrl),
    [profile?.user?.avatarUrl],
  );
  const initials = useMemo(
    () =>
      (profile?.fullName || profile?.user?.phone || 'В')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'В',
    [profile?.fullName, profile?.user?.phone],
  );

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/drivers/profile');
      const data = res.data;
      setProfile(data);
      setCourierTransportType(data.courierTransportType || 'FOOT');
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить профиль водителя');
    } finally {
      setLoading(false);
    }
  };

  const pickAndUploadAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        setModal({
          visible: true,
          title: 'Нужен доступ',
          message: permission.canAskAgain
            ? 'Разреши доступ к галерее, чтобы поставить аватарку.'
            : 'Доступ к галерее отключен. Открой настройки приложения и включи фото и видео.',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append('file', {
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: `avatar_${Date.now()}.jpg`,
      } as any);

      const response = await apiClient.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setProfile((current) =>
        current
          ? {
              ...current,
              user: {
                ...(current.user || {}),
                avatarUrl: response.data?.url || null,
              },
            }
          : current,
      );
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось загрузить аватарку';
      setModal({
        visible: true,
        title: 'Ошибка',
        message: Array.isArray(message) ? message.join(', ') : message,
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const confirmDeleteAccount = () => {
    setModal({
      visible: true,
      title: 'Удалить аккаунт?',
      message: 'Аккаунт будет отключен, а личные данные очищены. Войти обратно с этим профилем уже не получится.',
      primaryLabel: deletingAccount ? 'Удаляем...' : 'Удалить',
      secondaryLabel: 'Отмена',
      primaryVariant: 'danger',
      onPrimary: async () => {
        try {
          setDeletingAccount(true);
          await apiClient.delete('/users/me');
          await logout();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        } catch (error: any) {
          const message = error?.response?.data?.message || 'Не удалось удалить аккаунт';
          setModal({
            visible: true,
            title: 'Ошибка',
            message: Array.isArray(message) ? message.join(', ') : message,
          });
        } finally {
          setDeletingAccount(false);
        }
      },
      onSecondary: () => setModal({ visible: false, title: '', message: '' }),
    });
  };

  const toggleIntercity = async () => {
    try {
      setUpdatingIntercity(true);
      await apiClient.post('/drivers/intercity-capability', {
        supportsIntercity: !profile?.supportsIntercity,
      });
      await loadProfile();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось обновить межгород');
    } finally {
      setUpdatingIntercity(false);
    }
  };

  const toggleCourier = async (nextTransportType = courierTransportType) => {
    try {
      setUpdatingCourier(true);
      await apiClient.post('/drivers/courier-capability', {
        supportsCourier: !profile?.supportsCourier,
        courierTransportType: nextTransportType,
      });
      await loadProfile();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось обновить курьерский режим');
    } finally {
      setUpdatingCourier(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'Одобрен';
      case 'PENDING':
        return 'На проверке';
      case 'REJECTED':
        return 'Отклонен';
      default:
        return status;
    }
  };

  const getStatusTone = (status?: string) => {
    switch (status) {
      case 'APPROVED':
        return { bg: '#0F2A1C', fg: '#86EFAC', border: '#14532D' };
      case 'REJECTED':
        return { bg: '#2A1215', fg: '#FDA4AF', border: '#7F1D1D' };
      default:
        return { bg: '#18181B', fg: '#FCD34D', border: '#3F3F46' };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F4F4F5" />
      </View>
    );
  }

  const statusTone = getStatusTone(profile?.status);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>← Назад</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <TouchableOpacity
                style={styles.avatarWrap}
                onPress={() => pickAndUploadAvatar().catch(() => null)}
                activeOpacity={0.88}
              >
                <View style={styles.avatarCircle}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>{initials}</Text>
                  )}
                </View>
                <View style={styles.avatarEditBadge}>
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color="#09090B" />
                  ) : (
                    <Ionicons name="camera-outline" size={16} color="#09090B" />
                  )}
                </View>
              </TouchableOpacity>
              <View style={styles.heroMain}>
                <Text style={styles.heroTitle}>
                  {profile?.fullName || 'Водитель/курьер'}
                </Text>
                <Text style={styles.heroSubtitle}>
                  {profile?.user?.phone || 'Профиль исполнителя'}
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: statusTone.bg, borderColor: statusTone.border },
                  ]}
                >
                  <Text style={[styles.statusPillText, { color: statusTone.fg }]}>
                    {getStatusText(profile?.status || 'PENDING')}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.avatarHint}>Нажми на аватарку, чтобы изменить фото</Text>

            <View style={styles.heroDivider} />
            <View style={styles.statRow}>
              <StatCard
                label="Баланс"
                value={`${Math.round(Number(profile?.balance || 0))} ₸`}
                accent="#F4F4F5"
              />
              <StatCard
                label="Рейтинг"
                value={`${profile?.rating?.toFixed(1) || '5.0'} ★`}
                accent="#FBBF24"
              />
              <StatCard
                label="Текущий режим"
                value={
                  profile?.driverMode === 'INTERCITY'
                    ? 'Межгород'
                    : profile?.driverMode === 'COURIER'
                      ? 'Курьер'
                      : 'Такси'
                }
                accent="#60A5FA"
              />
            </View>
            <View style={styles.progressBlock}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Готовность профиля</Text>
                <Text style={styles.progressValue}>{readinessScore}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${readinessScore}%` }]} />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Что сделать сейчас</Text>
            <View style={[styles.urgentCard, { borderColor: urgentTasks.accent }]}>
              <Text style={[styles.urgentTitle, { color: urgentTasks.accent }]}>
                {urgentTasks.title}
              </Text>
              <Text style={styles.urgentStep}>{urgentTasks.step}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Данные и документы</Text>

            <View style={styles.documentsSummaryCard}>
              <Text style={styles.documentsSummaryTitle}>
                {profile?.fullName || 'Имя не указано'} • {profile?.user?.phone || 'Телефон не найден'}
              </Text>
              <Text style={styles.documentsSummaryText}>
                Авто: {hasCarInfo ? 'заполнено' : 'не заполнено'}. Документы: {profile?.documents?.length || 0}, одобрено: {approvedDocuments.length}.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('DriverDocuments')}
            >
              <Text style={styles.primaryButtonText}>Открыть документы</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Готовность к работе</Text>
            <Text style={styles.sectionSubtitle}>
              Что нужно для выхода на линию.
            </Text>

            <ReadinessCard
              title="Такси"
              subtitle="Права, СТС и автомобиль"
              ready={taxiReady}
              accent="#22C55E"
              steps={taxiSteps}
              badge={taxiReady ? 'Готов' : 'Не готов'}
            />

            <ReadinessCard
              title="Курьер"
              subtitle={
                courierTransportType === 'FOOT'
                  ? 'Пеший • удостоверение личности'
                  : `${TRANSPORT_LABELS[courierTransportType]} • авто и документы`
              }
              ready={courierReady}
              accent="#F59E0B"
              steps={courierSteps}
              badge={courierReady ? 'Готов' : 'Не готов'}
            />

            <ReadinessCard
              title="Межгород"
              subtitle="Публикация рейсов и заявки пассажиров"
              ready={intercityReady}
              accent="#38BDF8"
              steps={intercitySteps}
              badge={intercityReady ? 'Готов' : 'Не готов'}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Режимы работы</Text>

            <View style={styles.modeCard}>
              <Text style={styles.modeTitle}>Такси</Text>
              <Text style={styles.modeValue}>Всегда доступно для этого профиля</Text>
            </View>

            <View style={styles.modeCard}>
              <View style={styles.modeHeader}>
                <View>
                  <Text style={styles.modeTitle}>Курьер</Text>
                  <Text style={styles.modeValue}>
                    {profile?.supportsCourier
                      ? `Включен • ${TRANSPORT_LABELS[courierTransportType]}`
                      : 'Выключен'}
                  </Text>
                </View>
                <PillButton
                  title={updatingCourier ? 'Обновление...' : profile?.supportsCourier ? 'Выключить' : 'Включить'}
                  active={Boolean(profile?.supportsCourier)}
                  onPress={() => toggleCourier(courierTransportType)}
                  disabled={updatingCourier}
                />
              </View>

              <View style={styles.transportRow}>
                {(['FOOT', 'BIKE', 'CAR'] as const).map((type) => (
                  <PillButton
                    key={type}
                    title={TRANSPORT_LABELS[type]}
                    active={courierTransportType === type}
                    onPress={() => setCourierTransportType(type)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.modeCard}>
              <View style={styles.modeHeader}>
                <View>
                  <Text style={styles.modeTitle}>Межгород</Text>
                  <Text style={styles.modeValue}>
                    {profile?.supportsIntercity
                      ? 'Включен • рейсы доступны'
                      : 'Выключен'}
                  </Text>
                </View>
                <PillButton
                  title={
                    updatingIntercity
                      ? 'Обновление...'
                      : profile?.supportsIntercity
                        ? 'Выключить'
                        : 'Включить'
                  }
                  active={Boolean(profile?.supportsIntercity)}
                  onPress={toggleIntercity}
                  disabled={updatingIntercity}
                />
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.deleteAccountButton}
            onPress={confirmDeleteAccount}
            disabled={deletingAccount}
          >
            <Text style={styles.deleteAccountButtonText}>
              {deletingAccount ? 'Удаляем аккаунт...' : 'Удалить аккаунт'}
            </Text>
          </TouchableOpacity>

        </ScrollView>

        <DarkAlertModal
          visible={modal.visible}
          title={modal.title}
          message={modal.message}
          primaryLabel={
            modal.primaryLabel || (modal.message.includes('настройки приложения') ? 'Открыть настройки' : undefined)
          }
          secondaryLabel={
            modal.secondaryLabel || (modal.message.includes('настройки приложения') ? 'Позже' : undefined)
          }
          primaryVariant={modal.primaryVariant}
          onPrimary={() => {
            const action = modal.onPrimary;
            const shouldOpenSettings = !action && modal.message.includes('настройки приложения');
            setModal({ visible: false, title: '', message: '' });
            if (action) {
              void action();
              return;
            }
            if (shouldOpenSettings) {
              void Linking.openSettings();
            }
          }}
          onSecondary={() => {
            const action = modal.onSecondary;
            setModal({ visible: false, title: '', message: '' });
            if (action) {
              void action();
            }
          }}
        />
      </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090B',
  },
  headerRow: {
    paddingTop: 12,
    marginBottom: 14,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '600',
  },
  heroCard: {
    backgroundColor: '#111113',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 20,
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  avatarWrap: {
    alignSelf: 'flex-start',
    marginRight: 14,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: '#F4F4F5',
    fontSize: 24,
    fontWeight: '900',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F4F4F5',
    borderWidth: 2,
    borderColor: '#111113',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMain: {
    flex: 1,
  },
  heroTitle: {
    color: '#F4F4F5',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: '#A1A1AA',
    fontSize: 14,
    marginBottom: 10,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '800',
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#202024',
    marginBottom: 16,
  },
  avatarHint: {
    color: '#71717A',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  progressBlock: {
    marginTop: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
  },
  progressValue: {
    color: '#F4F4F5',
    fontSize: 13,
    fontWeight: '900',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#27272A',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 14,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  statLabel: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  section: {
    backgroundColor: '#111113',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#F4F4F5',
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: '#A1A1AA',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  urgentCard: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  urgentTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
  },
  urgentStep: {
    color: '#D4D4D8',
    fontSize: 14,
    lineHeight: 20,
  },
  readinessCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  readinessCardReady: {
    backgroundColor: '#0D1510',
  },
  readinessCardPending: {
    backgroundColor: '#18181B',
  },
  readinessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  readinessAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  readinessCopy: {
    flex: 1,
    paddingRight: 8,
  },
  readinessTitle: {
    color: '#F4F4F5',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  readinessSubtitle: {
    color: '#A1A1AA',
    fontSize: 13,
  },
  readinessBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  readinessBadgeText: {
    color: '#F4F4F5',
    fontSize: 12,
    fontWeight: '800',
  },
  readinessBadgeTextReady: {
    color: '#04130A',
  },
  readyText: {
    color: '#D4D4D8',
    fontSize: 14,
    lineHeight: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  stepDot: {
    color: '#A1A1AA',
    fontSize: 16,
    lineHeight: 20,
    marginRight: 8,
  },
  stepText: {
    flex: 1,
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 20,
  },
  modeCard: {
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 14,
    marginBottom: 12,
  },
  modeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  modeTitle: {
    color: '#F4F4F5',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  modeValue: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 180,
  },
  transportRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  pillButton: {
    flex: 1,
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  pillButtonActive: {
    backgroundColor: '#F4F4F5',
    borderColor: '#FFFFFF',
  },
  pillButtonText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '800',
  },
  pillButtonTextActive: {
    color: '#09090B',
  },
  primaryButton: {
    backgroundColor: '#F4F4F5',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#09090B',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryWideButton: {
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryWideButtonText: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
  },
  documentsSummaryCard: {
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 14,
  },
  documentsSummaryTitle: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  documentsSummaryText: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 18,
  },
  disabledButton: {
    opacity: 0.6,
  },
  deleteAccountButton: {
    backgroundColor: '#2B1114',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  deleteAccountButtonText: {
    color: '#FCA5A5',
    fontSize: 15,
    fontWeight: '900',
  },
});
