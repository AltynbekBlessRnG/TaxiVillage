import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, logout } from '../../api/client';
import { fetchRoles, switchRole, type RolesInfo } from '../../api/roles';
import { DarkAlertModal } from '../../components/DarkAlertModal';
import { LegalLinks } from '../../components/LegalLinks';
import { resolveApiAssetUrl } from '../../utils/assets';
import { showAlert } from '../../components/AppAlert';
import { VerifiedBadge } from '../../components/VerifiedBadge';
import { colors } from '../../theme/colors';

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
  documentsVerified?: boolean;
  /** False while the server lets drivers online without approved scans. */
  documentsRequired?: boolean;
  user?: { phone?: string; avatarUrl?: string | null };
}

const TRANSPORT_LABELS = {
  FOOT: 'Пеший',
  BIKE: 'Байк',
  CAR: 'Авто',
} as const;

type DocState = 'approved' | 'pending' | 'missing';

/** One thing that still keeps the driver off the line, with where to fix it. */
interface Blocker {
  label: string;
  /** Uploaded and waiting on the admin: nothing for the driver to do. */
  waiting?: boolean;
  onPress?: () => void;
}

const BlockerRow: React.FC<{ blocker: Blocker }> = ({ blocker }) => {
  const content = (
    <>
      <Ionicons
        name={blocker.waiting ? 'time-outline' : 'alert-circle-outline'}
        size={18}
        color={blocker.waiting ? colors.textSecondary : colors.warningText}
      />
      <Text style={[styles.blockerText, blocker.waiting && styles.blockerTextWaiting]}>
        {blocker.label}
      </Text>
      {blocker.onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      ) : null}
    </>
  );
  if (!blocker.onPress) {
    return <View style={styles.blockerRow}>{content}</View>;
  }
  return (
    <TouchableOpacity style={styles.blockerRow} onPress={blocker.onPress} accessibilityRole="button">
      {content}
    </TouchableOpacity>
  );
};

/** A service the driver can work in: on/off, and what it still needs. */
const ServiceCard: React.FC<{
  title: string;
  enabled: boolean;
  onToggle?: (next: boolean) => void;
  toggling?: boolean;
  blockers: Blocker[];
  children?: React.ReactNode;
}> = ({ title, enabled, onToggle, toggling = false, blockers, children }) => (
  <View style={styles.serviceCard}>
    <View style={styles.serviceHeader}>
      <View style={styles.serviceCopy}>
        <Text style={styles.serviceTitle}>{title}</Text>
        <Text style={[styles.serviceState, enabled && blockers.length === 0 && styles.serviceStateReady]}>
          {!enabled ? 'Выключено' : blockers.length === 0 ? 'Всё заполнено' : 'Нужно ещё:'}
        </Text>
      </View>
      {onToggle ? (
        toggling ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Switch
            value={enabled}
            onValueChange={onToggle}
            accessibilityLabel={`${title}: ${enabled ? 'включено' : 'выключено'}`}
            trackColor={{ false: colors.borderStrong, true: colors.successBorder }}
            thumbColor={colors.white}
          />
        )
      ) : null}
    </View>
    {enabled ? children : null}
    {enabled ? blockers.map((blocker) => <BlockerRow key={blocker.label} blocker={blocker} />) : null}
  </View>
);

export const DriverProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [profile, setProfile] = useState<DriverProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [updatingIntercity, setUpdatingIntercity] = useState(false);
  const [updatingCourier, setUpdatingCourier] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [roles, setRoles] = useState<RolesInfo | null>(null);
  const [switchingRole, setSwitchingRole] = useState(false);
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

  useEffect(() => {
    // Fetched apart from the profile so a failure costs only the role card.
    fetchRoles()
      .then(setRoles)
      .catch(() => setRoles(null));
  }, []);

  const goToPassengerMode = async () => {
    try {
      setSwitchingRole(true);
      await switchRole('PASSENGER');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось сменить роль';
      showAlert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setSwitchingRole(false);
    }
  };

  // Mirrors what the server checks when the driver goes online, so the
  // screen never asks for a scan nobody looks at.
  const documentsRequired = profile?.documentsRequired !== false;
  const docState = (type: Document['type']): DocState => {
    const docs = profile?.documents?.filter((doc) => doc.type === type) ?? [];
    if (docs.some((doc) => doc.approved)) {
      return 'approved';
    }
    return docs.length > 0 ? 'pending' : 'missing';
  };
  const hasCarInfo = !!(profile?.car?.make && profile?.car?.model && profile?.car?.color && profile?.car?.plateNumber);
  const openCar = () => navigation.navigate('DriverDocuments', { focus: 'car' });
  const openDocuments = () => navigation.navigate('DriverDocuments');

  const docBlocker = (type: Document['type'], name: string): Blocker | null => {
    if (!documentsRequired) {
      return null;
    }
    const state = docState(type);
    if (state === 'approved') {
      return null;
    }
    return state === 'pending'
      ? { label: `${name}: на проверке у администратора`, waiting: true }
      : { label: `Загрузите ${name.toLowerCase()}`, onPress: openDocuments };
  };
  const carBlocker: Blocker | null = hasCarInfo ? null : { label: 'Добавьте машину', onPress: openCar };
  const compact = (items: (Blocker | null)[]) => items.filter(Boolean) as Blocker[];

  // Approval and balance gate every service, so they are listed once at the top.
  const accountBlockers = compact([
    profile?.status === 'PENDING'
      ? { label: 'Администратор ещё не одобрил профиль', waiting: true }
      : null,
    profile?.status === 'REJECTED'
      ? { label: 'Администратор отклонил профиль. Напишите в поддержку', waiting: true }
      : null,
    Number(profile?.balance || 0) <= 0
      ? { label: 'Пополните баланс', onPress: () => navigation.navigate('DriverBalance') }
      : null,
  ]);

  const courierNeedsVehicle = courierTransportType !== 'FOOT';
  const taxiBlockers = compact([
    carBlocker,
    docBlocker('DRIVER_LICENSE', 'Права'),
    docBlocker('CAR_REGISTRATION', 'СТС'),
  ]);
  const courierBlockers = compact([
    docBlocker('COURIER_ID', 'Удостоверение личности'),
    courierNeedsVehicle ? carBlocker : null,
    courierNeedsVehicle ? docBlocker('DRIVER_LICENSE', 'Права') : null,
    courierNeedsVehicle ? docBlocker('CAR_REGISTRATION', 'СТС') : null,
  ]);
  const intercityBlockers = compact([carBlocker]);

  const carSummary = hasCarInfo
    ? `${profile?.car?.make} ${profile?.car?.model}, ${profile?.car?.color} • ${profile?.car?.plateNumber}`
    : 'Машина не добавлена';
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

  const loadProfile = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const res = await apiClient.get('/drivers/profile');
      const data = res.data;
      setProfile(data);
      setCourierTransportType(data.courierTransportType || 'FOOT');
    } catch {
      showAlert('Ошибка', 'Не удалось загрузить профиль водителя');
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

  const toggleIntercity = async (next: boolean) => {
    try {
      setUpdatingIntercity(true);
      await apiClient.post('/drivers/intercity-capability', { supportsIntercity: next });
      await loadProfile(true);
    } catch (e: any) {
      showAlert('Ошибка', e?.response?.data?.message || 'Не удалось обновить межгород');
    } finally {
      setUpdatingIntercity(false);
    }
  };

  // Also how a working courier changes transport: the switch stays on and
  // only the transport is saved.
  const saveCourier = async (supportsCourier: boolean, transport: 'CAR' | 'BIKE' | 'FOOT') => {
    const previousTransport = courierTransportType;
    setCourierTransportType(transport);
    try {
      setUpdatingCourier(true);
      await apiClient.post('/drivers/courier-capability', {
        supportsCourier,
        courierTransportType: transport,
      });
      await loadProfile(true);
    } catch (e: any) {
      setCourierTransportType(previousTransport);
      showAlert('Ошибка', e?.response?.data?.message || 'Не удалось обновить курьерский режим');
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
        return { bg: colors.successSurface, fg: colors.successText, border: colors.successBorder };
      case 'REJECTED':
        return { bg: colors.dangerSurface, fg: colors.dangerText, border: colors.dangerBorder };
      default:
        return { bg: colors.surface, fg: colors.warningText, border: colors.borderStrong };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.text} />
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
                accessibilityRole="button"
                accessibilityLabel="Изменить фото профиля"
                accessibilityState={{ busy: uploadingAvatar }}
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
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <Ionicons name="camera-outline" size={16} color={colors.textInverse} />
                  )}
                </View>
              </TouchableOpacity>
              <View style={styles.heroMain}>
                <Text style={styles.heroTitle}>{profile?.fullName || 'Водитель'}</Text>
                <Text style={styles.heroSubtitle}>{profile?.user?.phone || ''}</Text>
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

            <View style={styles.statRow}>
              <TouchableOpacity
                style={styles.statCard}
                onPress={() => navigation.navigate('DriverBalance')}
                accessibilityRole="button"
                accessibilityLabel={`Баланс ${Math.round(Number(profile?.balance || 0))} тенге. Пополнить`}
              >
                <Text style={styles.statValue}>{`${Math.round(Number(profile?.balance || 0))} ₸`}</Text>
                <Text style={styles.statLabel}>Баланс • пополнить ›</Text>
              </TouchableOpacity>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: colors.warningText }]}>
                  {`${profile?.rating?.toFixed(1) || '5.0'} ★`}
                </Text>
                <Text style={styles.statLabel}>Рейтинг</Text>
              </View>
            </View>
          </View>

          {accountBlockers.length > 0 ? (
            <View style={[styles.section, styles.blockedSection]}>
              <Text style={styles.sectionTitle}>Пока нельзя выйти на линию</Text>
              {accountBlockers.map((blocker) => (
                <BlockerRow key={blocker.label} blocker={blocker} />
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Где вы работаете</Text>
            <Text style={styles.sectionSubtitle}>
              Включите то, чем хотите заниматься. Переключаться между ними можно на главном экране.
            </Text>

            {profile?.supportsTaxi !== false ? (
              <ServiceCard title="Такси" enabled blockers={taxiBlockers} />
            ) : null}

            <ServiceCard
              title="Доставка"
              enabled={Boolean(profile?.supportsCourier)}
              toggling={updatingCourier}
              onToggle={(next) => saveCourier(next, courierTransportType).catch(() => null)}
              blockers={courierBlockers}
            >
              <Text style={styles.transportLabel}>На чём доставляете</Text>
              <View style={styles.transportRow}>
                {(['FOOT', 'BIKE', 'CAR'] as const).map((type) => {
                  const active = courierTransportType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.pillButton, active && styles.pillButtonActive]}
                      onPress={() => {
                        if (!active && !updatingCourier) {
                          saveCourier(true, type).catch(() => null);
                        }
                      }}
                      disabled={updatingCourier}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active, disabled: updatingCourier }}
                    >
                      <Text style={[styles.pillButtonText, active && styles.pillButtonTextActive]}>
                        {TRANSPORT_LABELS[type]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ServiceCard>

            <ServiceCard
              title="Межгород"
              enabled={Boolean(profile?.supportsIntercity)}
              toggling={updatingIntercity}
              onToggle={(next) => toggleIntercity(next).catch(() => null)}
              blockers={intercityBlockers}
            />
          </View>

          <TouchableOpacity style={styles.linkRow} onPress={openDocuments} accessibilityRole="button">
            <Ionicons name="car-outline" size={22} color={colors.text} />
            <View style={styles.linkRowCopy}>
              <Text style={styles.linkRowTitle}>Машина и документы</Text>
              <Text style={styles.linkRowSubtitle} numberOfLines={2}>
                {carSummary}
              </Text>
              {profile?.documentsVerified ? (
                <VerifiedBadge verified />
              ) : (
                <Text style={styles.linkRowHint}>
                  Загрузите права и СТС: после проверки пассажиры увидят у вас отметку «Документы проверены».
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {roles?.availableRoles.includes('PASSENGER') ? (
            <TouchableOpacity
              style={[styles.linkRow, switchingRole && styles.disabledButton]}
              onPress={goToPassengerMode}
              disabled={switchingRole}
              accessibilityRole="button"
            >
              <Ionicons name="person-outline" size={22} color={colors.text} />
              <View style={styles.linkRowCopy}>
                <Text style={styles.linkRowTitle}>
                  {switchingRole ? 'Переключаем...' : 'Перейти в режим пассажира'}
                </Text>
                <Text style={styles.linkRowSubtitle}>Заказывайте такси и еду с этого же аккаунта.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}

          <LegalLinks />

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
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  headerRow: {
    paddingTop: 12,
    marginBottom: 14,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  heroCard: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: colors.text,
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
    backgroundColor: colors.surfaceInverse,
    borderWidth: 2,
    borderColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMain: {
    flex: 1,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: colors.textSecondary,
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
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  section: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  transportRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  pillButton: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  pillButtonActive: {
    backgroundColor: colors.surfaceInverse,
    borderColor: colors.white,
  },
  pillButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  pillButtonTextActive: {
    color: colors.textInverse,
  },
  disabledButton: {
    opacity: 0.6,
  },
  deleteAccountButton: {
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  deleteAccountButtonText: {
    color: colors.dangerText,
    fontSize: 15,
    fontWeight: '900',
  },
  blockedSection: {
    borderColor: colors.warning,
  },
  blockerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  blockerText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  blockerTextWaiting: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  serviceCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
  },
  serviceCopy: {
    flex: 1,
  },
  serviceTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  serviceState: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  serviceStateReady: {
    color: colors.successText,
    fontWeight: '700',
  },
  transportLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 12,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceSunken,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  linkRowCopy: {
    flex: 1,
  },
  linkRowTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  linkRowSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  linkRowHint: {
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
});
