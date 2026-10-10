import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, logout } from '../../api/client';
import { becomeDriver, fetchRoles, switchRole, type RolesInfo } from '../../api/roles';
import { DarkAlertModal } from '../../components/DarkAlertModal';
import { LegalLinks } from '../../components/LegalLinks';
import { resolveApiAssetUrl } from '../../utils/assets';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'PassengerProfile'>;

type PassengerProfileData = {
  fullName: string;
  phone: string;
  avatarUrl?: string | null;
};

export const PassengerProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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
  const [profile, setProfile] = useState<PassengerProfileData>({
    fullName: 'Пользователь',
    phone: '',
    avatarUrl: null,
  });
  const [roles, setRoles] = useState<RolesInfo | null>(null);
  const [switchingRole, setSwitchingRole] = useState(false);

  useEffect(() => {
    // The role list is a separate call so a failure here only costs the role
    // card, not the whole profile screen.
    fetchRoles()
      .then(setRoles)
      .catch(() => setRoles(null));
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await apiClient.get('/users/me');
        setProfile({
          fullName: res.data?.passenger?.fullName || res.data?.phone || 'Пользователь',
          phone: res.data?.phone || '',
          avatarUrl: res.data?.avatarUrl || null,
        });
      } catch {
        setProfile({
          fullName: 'Пользователь',
          phone: '',
          avatarUrl: null,
        });
      } finally {
        setLoading(false);
      }
    };

    loadProfile().catch(() => setLoading(false));
  }, []);

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

      setProfile((current) => ({
        ...current,
        avatarUrl: response.data?.url || null,
      }));
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

  const runRoleChange = async (action: () => Promise<unknown>) => {
    try {
      setSwitchingRole(true);
      await action();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось сменить роль';
      setModal({
        visible: true,
        title: 'Ошибка',
        message: Array.isArray(message) ? message.join(', ') : message,
      });
    } finally {
      setSwitchingRole(false);
    }
  };

  const confirmBecomeDriver = () => {
    setModal({
      visible: true,
      title: 'Стать водителем?',
      message:
        'Профиль пассажира сохранится — переключаться между режимами можно в любой момент. Перед выходом на линию нужно будет заполнить данные об автомобиле.',
      primaryLabel: 'Стать водителем',
      secondaryLabel: 'Отмена',
      onPrimary: () => runRoleChange(() => becomeDriver(profile.fullName)),
    });
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

  const initials = useMemo(() => {
    return (
      (profile.fullName || profile.phone || 'П')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'П'
    );
  }, [profile.fullName, profile.phone]);

  const avatarUri = useMemo(() => resolveApiAssetUrl(profile.avatarUrl), [profile.avatarUrl]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Назад"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Личный кабинет</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
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
            <Text style={styles.fullName}>{profile.fullName}</Text>
            <Text style={styles.phone}>{profile.phone || 'Номер не указан'}</Text>
            <Text style={styles.avatarHint}>Нажми на аватарку, чтобы изменить фото</Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>Контакты</Text>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="call-outline" size={18} color={colors.text} />
              </View>
              <View style={styles.infoBody}>
                <Text style={styles.infoLabel}>Номер телефона</Text>
                <Text style={styles.infoValue}>{profile.phone || 'Не указан'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>Оплата</Text>
            <View style={styles.paymentRow}>
              <View style={styles.cashBadge}>
                <Ionicons name="cash-outline" size={18} color={colors.onAccent} />
              </View>
              <View style={styles.infoBody}>
                <Text style={styles.infoLabel}>Способ оплаты</Text>
                <Text style={styles.infoValue}>Наличные</Text>
                <Text style={styles.infoHint}>Смена на карту появится позже.</Text>
              </View>
            </View>
          </View>

          {roles ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>Роль</Text>
              {roles.availableRoles.includes('DRIVER') ? (
                <>
                  <View style={styles.infoRow}>
                    <View style={styles.infoIcon}>
                      <Ionicons name="car-outline" size={18} color={colors.text} />
                    </View>
                    <View style={styles.infoBody}>
                      <Text style={styles.infoLabel}>Сейчас вы пассажир</Text>
                      <Text style={styles.infoHint}>У аккаунта есть и профиль водителя.</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.roleButton}
                    onPress={() => runRoleChange(() => switchRole('DRIVER'))}
                    disabled={switchingRole}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.roleButtonText}>
                      {switchingRole ? 'Переключаем...' : 'Перейти в режим водителя'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.infoRow}>
                    <View style={styles.infoIcon}>
                      <Ionicons name="car-outline" size={18} color={colors.text} />
                    </View>
                    <View style={styles.infoBody}>
                      <Text style={styles.infoLabel}>Хотите возить пассажиров?</Text>
                      <Text style={styles.infoHint}>
                        Заводить второй номер не нужно — профиль пассажира сохранится.
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.roleButton}
                    onPress={confirmBecomeDriver}
                    disabled={switchingRole}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.roleButtonText}>
                      {switchingRole ? 'Подключаем...' : 'Стать водителем'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : null}

          <LegalLinks />

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={confirmDeleteAccount}
            disabled={deletingAccount}
          >
            <Text style={styles.deleteButtonText}>
              {deletingAccount ? 'Удаляем аккаунт...' : 'Удалить аккаунт'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

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
            Linking.openSettings().catch(() => null);
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  headerSpacer: {
    width: 44,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 14,
  },
  heroCard: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  avatarWrap: {
    marginBottom: 14,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: colors.textMuted,
    fontSize: 28,
    fontWeight: '900',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surfaceSunken,
  },
  fullName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  phone: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  avatarHint: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
  sectionCard: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  sectionEyebrow: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cashBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoBody: {
    flex: 1,
  },
  infoLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  infoValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  infoHint: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  roleButton: {
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  roleButtonText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '900',
  },
  deleteButton: {
    marginTop: 4,
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.dangerText,
    fontSize: 15,
    fontWeight: '900',
  },
});
