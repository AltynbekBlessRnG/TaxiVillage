import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, logout } from '../../api/client';
import { DarkAlertModal } from '../../components/DarkAlertModal';
import { resolveApiAssetUrl } from '../../utils/assets';

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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#F4F4F5" />
        </TouchableOpacity>
        <Text style={styles.title}>Личный кабинет</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#F4F4F5" />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.heroCard}>
            <TouchableOpacity style={styles.avatarWrap} onPress={() => pickAndUploadAvatar().catch(() => null)} activeOpacity={0.88}>
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
            <Text style={styles.fullName}>{profile.fullName}</Text>
            <Text style={styles.phone}>{profile.phone || 'Номер не указан'}</Text>
            <Text style={styles.avatarHint}>Нажми на аватарку, чтобы изменить фото</Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>Контакты</Text>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="call-outline" size={18} color="#F4F4F5" />
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
                <Ionicons name="cash-outline" size={18} color="#04131A" />
              </View>
              <View style={styles.infoBody}>
                <Text style={styles.infoLabel}>Способ оплаты</Text>
                <Text style={styles.infoValue}>Наличные</Text>
                <Text style={styles.infoHint}>Смена на карту появится позже.</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={confirmDeleteAccount}
            disabled={deletingAccount}
          >
            <Text style={styles.deleteButtonText}>
              {deletingAccount ? 'Удаляем аккаунт...' : 'Удалить аккаунт'}
            </Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: '#09090B',
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
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#F4F4F5',
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
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#111113',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#27272A',
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
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: '#E2E8F0',
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
    backgroundColor: '#FACC15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#111113',
  },
  fullName: {
    color: '#F4F4F5',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  phone: {
    color: '#A1A1AA',
    fontSize: 15,
    fontWeight: '600',
  },
  avatarHint: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
  sectionCard: {
    backgroundColor: '#111113',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 18,
  },
  sectionEyebrow: {
    color: '#71717A',
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
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cashBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FACC15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoBody: {
    flex: 1,
  },
  infoLabel: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  infoValue: {
    color: '#F4F4F5',
    fontSize: 18,
    fontWeight: '800',
  },
  infoHint: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  deleteButton: {
    marginTop: 4,
    backgroundColor: '#2B1114',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FCA5A5',
    fontSize: 15,
    fontWeight: '900',
  },
});
