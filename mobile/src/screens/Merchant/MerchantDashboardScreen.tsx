import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, logout } from '../../api/client';
import { DarkAlertModal } from '../../components/DarkAlertModal';
import { LegalLinks } from '../../components/LegalLinks';
import { PrimaryButton, SecondaryButton } from '../../components/ServiceScreen';
import { MerchantSideDrawer } from './MerchantSideDrawer';
import { resolveApiAssetUrl } from '../../utils/assets';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'MerchantDashboard'>;

type MerchantModalState = {
  visible: boolean;
  title: string;
  message: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
};

export const MerchantDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [name, setName] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [etaMinutes, setEtaMinutes] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('700');
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState('8');
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('23:00');
  const [isOpen, setIsOpen] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [modal, setModal] = useState<MerchantModalState>({
    visible: false,
    title: '',
    message: '',
  });
  const sideMenuAnim = useRef(new Animated.Value(-320)).current;
  const menuBackdropOpacity = useRef(new Animated.Value(0)).current;

  const closeModal = () =>
    setModal({
      visible: false,
      title: '',
      message: '',
    });

  const openModal = (next: Omit<MerchantModalState, 'visible'>) =>
    setModal({
      visible: true,
      ...next,
    });

  const coverUri = resolveApiAssetUrl(coverImageUrl);

  const loadProfile = useCallback(() => {
    setLoading(true);
    apiClient
      .get('/merchants/profile/me')
      .then((response) => {
        const next = response.data;
        setProfile(next);
        setName(next?.name || '');
        setCuisine(next?.cuisine || '');
        setDescription(next?.description || '');
        setCoverImageUrl(next?.coverImageUrl || '');
        setWhatsAppPhone(next?.whatsAppPhone || '');
        setContactPhone(next?.contactPhone || next?.user?.phone || '');
        setAddress(next?.address || '');
        setEtaMinutes(next?.etaMinutes ? String(next.etaMinutes) : '');
        setMinOrder(next?.minOrder ? String(Math.round(Number(next.minOrder))) : '');
        setDeliveryFee(
          next?.deliveryFee != null ? String(Math.round(Number(next.deliveryFee))) : '700',
        );
        setDeliveryRadiusKm(
          next?.deliveryRadiusKm != null ? String(next.deliveryRadiusKm) : '8',
        );
        const firstWindow = next?.openingHours?.mon?.[0];
        setOpenTime(firstWindow?.open || '09:00');
        setCloseTime(firstWindow?.close || '23:00');
        setIsOpen(Boolean(next?.isOpen));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(sideMenuAnim, {
        toValue: isMenuOpen ? 0 : -320,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(menuBackdropOpacity, {
        toValue: isMenuOpen ? 1 : 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isMenuOpen, sideMenuAnim, menuBackdropOpacity]);

  const pickAndUploadCover = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        openModal({
          title: 'Нужен доступ',
          message: 'Разреши доступ к галерее, чтобы загрузить фото заведения.',
          primaryLabel: 'Понятно',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.85,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      setUploadingCover(true);
      const formData = new FormData();
      formData.append('file', {
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: `merchant_cover_${Date.now()}.jpg`,
      } as any);

      const response = await apiClient.post('/merchants/profile/cover-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setCoverImageUrl(response.data.url);
    } catch (error: any) {
      openModal({
        title: 'Ошибка',
        message: error?.response?.data?.message || 'Не удалось загрузить фото заведения',
        primaryLabel: 'Понятно',
      });
    } finally {
      setUploadingCover(false);
    }
  }, []);

  const saveProfile = async () => {
    if (!name.trim()) {
      openModal({
        title: 'Нужно название',
        message: 'Укажи название заведения.',
        primaryLabel: 'Понятно',
      });
      return;
    }

    try {
      setSaving(true);
      const dailyWindow = [{ open: openTime.trim(), close: closeTime.trim() }];
      await apiClient.patch('/merchants/profile/me', {
        name: name.trim(),
        cuisine: cuisine.trim() || undefined,
        description: description.trim() || undefined,
        coverImageUrl: coverImageUrl.trim() || undefined,
        whatsAppPhone: whatsAppPhone.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        address: address.trim() || undefined,
        etaMinutes: etaMinutes.trim() ? Number(etaMinutes) : undefined,
        minOrder: minOrder.trim() ? Number(minOrder) : undefined,
        deliveryFee: deliveryFee.trim() ? Number(deliveryFee) : undefined,
        deliveryRadiusKm: deliveryRadiusKm.trim()
          ? Number(deliveryRadiusKm)
          : undefined,
        openingHours: {
          mon: dailyWindow,
          tue: dailyWindow,
          wed: dailyWindow,
          thu: dailyWindow,
          fri: dailyWindow,
          sat: dailyWindow,
          sun: dailyWindow,
        },
        isOpen,
      });
      await loadProfile();
      openModal({
        title: 'Готово',
        message: 'Карточка заведения обновлена',
        primaryLabel: 'Отлично',
      });
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось сохранить профиль';
      openModal({
        title: 'Ошибка',
        message: Array.isArray(message) ? message.join(', ') : message,
        primaryLabel: 'Понятно',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigation.replace('Login');
  };

  const handleDeleteAccount = () => {
    openModal({
      title: 'Удалить аккаунт?',
      message: 'Аккаунт заведения будет отключен, витрина закроется, а вход станет недоступен.',
      primaryLabel: deletingAccount ? 'Удаляем...' : 'Удалить',
      secondaryLabel: 'Отмена',
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
          openModal({
            title: 'Ошибка',
            message: Array.isArray(message) ? message.join(', ') : message,
            primaryLabel: 'Понятно',
          });
        } finally {
          setDeletingAccount(false);
        }
      },
      onSecondary: closeModal,
    });
  };

  const handleOpenPreview = () => {
    if (!profile?.id) {
      openModal({
        title: 'Пока недоступно',
        message: 'Сначала сохрани карточку заведения.',
        primaryLabel: 'Понятно',
      });
      return;
    }

    navigation.navigate('Restaurant', {
      restaurantId: profile.id,
      restaurantName: profile?.name || name.trim() || 'Ресторан',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.food} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <Pressable style={styles.flex} onPress={Keyboard.dismiss}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.burgerBtn}
          onPress={() => setIsMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Меню"
        >
          <Text style={styles.burgerIcon}>☰</Text>
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Кабинет заведения</Text>
          <Text style={styles.topBarSubtitle}>{name.trim() || 'Ресторан'}</Text>
        </View>

        <View style={styles.topBarToggle}>
          <Text style={[styles.topBarToggleText, isOpen ? styles.topBarToggleTextActive : styles.topBarToggleTextMuted]}>
            {isOpen ? 'Открыт' : 'Закрыт'}
          </Text>
          <Switch
            value={isOpen}
            onValueChange={setIsOpen}
            accessibilityLabel="Заведение открыто"
            trackColor={{ false: colors.dangerBorder, true: colors.successBorder }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <ImageBackground
          source={coverUri ? { uri: coverUri } : undefined}
          style={[styles.coverPreview, { backgroundColor: profile?.tone || colors.foodBorder }]}
          imageStyle={styles.coverPreviewImage}
        >
          <View style={styles.coverOverlay} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroMetaChip}>
              <Text style={styles.heroMetaChipText}>{cuisine.trim() || 'Кухня'}</Text>
            </View>
            <View style={styles.heroMetaChip}>
              <Text style={styles.heroMetaChipText}>
                {etaMinutes.trim() || profile?.etaMinutes || 35} мин
              </Text>
            </View>
          </View>
          <View style={styles.coverMeta}>
            <Text style={styles.coverTitle}>{name.trim() || 'Название заведения'}</Text>
            <Text style={styles.coverSubtitle} numberOfLines={2}>
              {description.trim() || cuisine.trim() || 'Витрина ресторана для каталога еды'}
            </Text>
          </View>
        </ImageBackground>

        <View style={styles.quickActionRow}>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate('MenuEditor')}>
            <Text style={styles.quickActionTitle}>Меню</Text>
            <Text style={styles.quickActionText}>Категории и блюда</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate('MerchantOrders')}>
            <Text style={styles.quickActionTitle}>Заказы</Text>
            <Text style={styles.quickActionText}>Новые и активные</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionCard} onPress={handleOpenPreview}>
            <Text style={styles.quickActionTitle}>Превью</Text>
            <Text style={styles.quickActionText}>Как видит клиент</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricsStrip}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{profile?.menuCategories?.length || 0}</Text>
            <Text style={styles.metricLabel}>категорий</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{Math.round(Number(profile?.minOrder || 0))}</Text>
            <Text style={styles.metricLabel}>мин. чек</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{profile?.completedOrderCount || 0}</Text>
            <Text style={styles.metricLabel}>заказов</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionEyebrow}>Для клиентов</Text>
              <Text style={styles.sectionTitle}>Карточка заведения</Text>
            </View>
            <View style={styles.photoButtonWrap}>
              <SecondaryButton
                title={uploadingCover ? 'Загружаем...' : 'Фото'}
                onPress={() => pickAndUploadCover().catch(() => null)}
              />
            </View>
          </View>

          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="Название заведения"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            value={cuisine}
            onChangeText={setCuisine}
            style={styles.input}
            placeholder="Кухня"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            style={[styles.input, styles.multilineInput]}
            placeholder="Короткое описание"
            placeholderTextColor={colors.textTertiary}
            multiline
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Заказы</Text>
          <Text style={styles.sectionTitle}>Контакты и доставка</Text>
          <TextInput
            value={contactPhone}
            onChangeText={setContactPhone}
            style={styles.input}
            placeholder="Телефон ответственного"
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
          />
          <TextInput
            value={address}
            onChangeText={setAddress}
            style={styles.input}
            placeholder="Адрес заведения"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            value={whatsAppPhone}
            onChangeText={setWhatsAppPhone}
            style={styles.input}
            placeholder="WhatsApp для резервной связи (необязательно)"
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
          />
          <View style={styles.row}>
            <TextInput
              value={etaMinutes}
              onChangeText={setEtaMinutes}
              style={[styles.input, styles.halfInput]}
              placeholder="Приготовление, мин"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
            <TextInput
              value={minOrder}
              onChangeText={setMinOrder}
              style={[styles.input, styles.halfInput]}
              placeholder="Мин. чек"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.row}>
            <TextInput
              value={openTime}
              onChangeText={setOpenTime}
              style={[styles.input, styles.halfInput]}
              placeholder="Открытие 09:00"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              value={closeTime}
              onChangeText={setCloseTime}
              style={[styles.input, styles.halfInput]}
              placeholder="Закрытие 23:00"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <View style={styles.row}>
            <TextInput
              value={deliveryFee}
              onChangeText={setDeliveryFee}
              style={[styles.input, styles.halfInput]}
              placeholder="Доставка, ₸"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
            <TextInput
              value={deliveryRadiusKm}
              onChangeText={setDeliveryRadiusKm}
              style={[styles.input, styles.halfInput]}
              placeholder="Радиус, км"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.whatsappPanel}>
            <Text style={styles.whatsappPanelLabel}>Заказы приходят</Text>
            <Text style={styles.whatsappPanelValue}>
              В раздел «Заказы» и push-уведомления Zhetysu Go
            </Text>
          </View>
        </View>

        <View style={styles.bottomActions}>
          <PrimaryButton
            title={saving ? 'Сохраняем...' : 'Сохранить изменения'}
            onPress={() => saveProfile().catch(() => null)}
            accentColor={colors.food}
          />
          <LegalLinks />
          <TouchableOpacity
            style={styles.deleteAccountButton}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
          >
            <Text style={styles.deleteAccountButtonText}>
              {deletingAccount ? 'Удаляем аккаунт...' : 'Удалить аккаунт'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
        </Pressable>
      </KeyboardAvoidingView>

      <MerchantSideDrawer
        visible={isMenuOpen}
        sideMenuAnim={sideMenuAnim}
        menuBackdropOpacity={menuBackdropOpacity}
        name={name.trim() || profile?.name}
        phone={profile?.user?.phone || profile?.phone || whatsAppPhone}
        isOpen={isOpen}
        onClose={() => setIsMenuOpen(false)}
        onOpenMenuEditor={() => {
          setIsMenuOpen(false);
          navigation.navigate('MenuEditor');
        }}
        onOpenOrders={() => {
          setIsMenuOpen(false);
          navigation.navigate('MerchantOrders');
        }}
        onOpenPreview={() => {
          setIsMenuOpen(false);
          handleOpenPreview();
        }}
        onLogout={() => {
          setIsMenuOpen(false);
          void handleLogout();
        }}
      />

      <DarkAlertModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        primaryLabel={modal.primaryLabel}
        secondaryLabel={modal.secondaryLabel}
        onPrimary={() => {
          const action = modal.onPrimary;
          if (action) {
            action();
            return;
          }
          closeModal();
        }}
        onSecondary={() => {
          const action = modal.onSecondary;
          if (action) {
            action();
            return;
          }
          closeModal();
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
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  burgerBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burgerIcon: {
    color: colors.text,
    fontSize: 22,
  },
  topBarCenter: {
    flex: 1,
    marginHorizontal: 14,
  },
  topBarTitle: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 2,
    letterSpacing: 0.7,
  },
  topBarSubtitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  topBarToggle: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  topBarToggleText: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  topBarToggleTextActive: {
    color: colors.successText,
  },
  topBarToggleTextMuted: {
    color: colors.dangerText,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  coverPreview: {
    borderRadius: 28,
    minHeight: 240,
    marginBottom: 18,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'flex-end',
  },
  coverPreviewImage: {
    borderRadius: 28,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9,9,11,0.28)',
  },
  heroTopRow: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroMetaChip: {
    backgroundColor: 'rgba(9,9,11,0.72)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heroMetaChipText: {
    color: colors.foodTextSoft,
    fontSize: 11,
    fontWeight: '800',
  },
  coverMeta: {
    padding: 20,
  },
  coverTitle: {
    color: colors.foodTextSoft,
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 6,
  },
  coverSubtitle: {
    color: colors.foodTextSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  quickActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  quickActionCard: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    minHeight: 92,
    borderRadius: 22,
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-between',
  },
  quickActionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  quickActionText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  metricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    paddingVertical: 14,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.surfaceRaised,
  },
  metricValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  metricLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 14,
  },
  sectionHeading: {
    flex: 1,
  },
  photoButtonWrap: {
    width: 110,
  },
  sectionEyebrow: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.7,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  multilineInput: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  whatsappPanel: {
    marginTop: 2,
    backgroundColor: colors.successSurface,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  whatsappPanelLabel: {
    color: colors.successText,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  whatsappPanelValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  bottomActions: {
    paddingBottom: 18,
  },
  deleteAccountButton: {
    marginTop: 12,
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  deleteAccountButtonText: {
    color: colors.dangerText,
    fontSize: 15,
    fontWeight: '900',
  },
});
