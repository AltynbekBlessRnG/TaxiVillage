import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, logout } from '../../api/client';
import {
  InlineLabel,
  PrimaryButton,
  SecondaryButton,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'MerchantDashboard'>;

export const MerchantDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [name, setName] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [etaMinutes, setEtaMinutes] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [isOpen, setIsOpen] = useState(true);

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
        setEtaMinutes(next?.etaMinutes ? String(next.etaMinutes) : '');
        setMinOrder(next?.minOrder ? String(Math.round(Number(next.minOrder))) : '');
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

  const pickAndUploadCover = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Нужен доступ', 'Разреши доступ к галерее, чтобы загрузить фото заведения.');
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
      Alert.alert('Ошибка', error?.response?.data?.message || 'Не удалось загрузить фото заведения');
    } finally {
      setUploadingCover(false);
    }
  }, []);

  const saveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Нужно название', 'Укажи название заведения.');
      return;
    }

    if (!whatsAppPhone.trim()) {
      Alert.alert('Нужен WhatsApp', 'Укажи номер, на который будут приходить заказы.');
      return;
    }

    try {
      setSaving(true);
      await apiClient.patch('/merchants/profile/me', {
        name: name.trim(),
        cuisine: cuisine.trim() || undefined,
        description: description.trim() || undefined,
        coverImageUrl: coverImageUrl.trim() || undefined,
        whatsAppPhone: whatsAppPhone.trim(),
        etaMinutes: etaMinutes.trim() ? Number(etaMinutes) : undefined,
        minOrder: minOrder.trim() ? Number(minOrder) : undefined,
        isOpen,
      });
      await loadProfile();
      Alert.alert('Готово', 'Карточка заведения обновлена');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось сохранить профиль';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigation.replace('Login');
  };

  const handleOpenPreview = () => {
    if (!profile?.id) {
      Alert.alert('Пока недоступно', 'Сначала сохрани карточку заведения.');
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
        <ActivityIndicator size="large" color="#FB923C" />
      </View>
    );
  }

  return (
      <ServiceScreen
        accentColor="#FB923C"
        eyebrow="Merchant"
        title="Заведение"
        subtitle="Карточка ресторана, WhatsApp для заказов и быстрый доступ к меню."
    >
      <ServiceCard>
        <ImageBackground
          source={coverImageUrl ? { uri: coverImageUrl } : undefined}
          style={[styles.coverPreview, { backgroundColor: profile?.tone || '#7C2D12' }]}
          imageStyle={styles.coverPreviewImage}
        >
          <View style={styles.coverOverlay} />
          <View style={styles.coverMeta}>
            <Text style={styles.coverTitle}>{name.trim() || 'Название заведения'}</Text>
            <Text style={styles.coverSubtitle} numberOfLines={2}>
              {description.trim() || cuisine.trim() || 'Фото витрины увидит клиент в каталоге еды'}
            </Text>
          </View>
        </ImageBackground>

        <SecondaryButton
          title={uploadingCover ? 'Загружаем фото...' : 'Выбрать фото заведения'}
          onPress={() => pickAndUploadCover().catch(() => null)}
        />
      </ServiceCard>

      <ServiceCard>
        <Text style={styles.sectionTitle}>Карточка ресторана</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholder="Название заведения"
          placeholderTextColor="#71717A"
        />
        <TextInput
          value={cuisine}
          onChangeText={setCuisine}
          style={styles.input}
          placeholder="Кухня"
          placeholderTextColor="#71717A"
        />
        <TextInput
          value={description}
          onChangeText={setDescription}
          style={[styles.input, styles.multilineInput]}
          placeholder="Короткое описание заведения"
          placeholderTextColor="#71717A"
          multiline
        />
        <TextInput
          value={whatsAppPhone}
          onChangeText={setWhatsAppPhone}
          style={styles.input}
          placeholder="WhatsApp номер для заказов"
          placeholderTextColor="#71717A"
          keyboardType="phone-pad"
        />
        <View style={styles.row}>
          <TextInput
            value={etaMinutes}
            onChangeText={setEtaMinutes}
            style={[styles.input, styles.halfInput]}
            placeholder="ETA, мин"
            placeholderTextColor="#71717A"
            keyboardType="numeric"
          />
          <TextInput
            value={minOrder}
            onChangeText={setMinOrder}
            style={[styles.input, styles.halfInput]}
            placeholder="Мин. чек"
            placeholderTextColor="#71717A"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Статус заведения</Text>
          <View style={styles.toggleButtons}>
            <TouchableOpacity
              style={[styles.toggleButton, isOpen && styles.toggleButtonActive]}
              onPress={() => setIsOpen(true)}
            >
              <Text style={[styles.toggleButtonText, isOpen && styles.toggleButtonTextActive]}>
                Открыто
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, !isOpen && styles.toggleButtonActiveMuted]}
              onPress={() => setIsOpen(false)}
            >
              <Text style={[styles.toggleButtonText, !isOpen && styles.toggleButtonTextActiveMuted]}>
                Закрыто
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <PrimaryButton
          title={saving ? 'Сохраняем...' : 'Сохранить карточку'}
          onPress={() => saveProfile().catch(() => null)}
        />
      </ServiceCard>

      <ServiceCard compact>
        <InlineLabel label="WhatsApp" value={profile?.whatsAppPhone || 'Не указан'} />
        <InlineLabel label="Меню" value={`${profile?.menuCategories?.length || 0} категорий`} />
        <InlineLabel
          label="Витрина"
          value={profile?.isOpen ? 'Открыта для клиентов' : 'Скрыта из каталога'}
          accentColor={profile?.isOpen ? '#86EFAC' : '#FCA5A5'}
        />
      </ServiceCard>

      <PrimaryButton title="Редактор меню" onPress={() => navigation.navigate('MenuEditor')} />
      <SecondaryButton
        title="Посмотреть как видит клиент"
        onPress={handleOpenPreview}
      />
      <SecondaryButton title="Открыть заказы" onPress={() => navigation.navigate('MerchantOrders')} />
      <SecondaryButton title="Выйти из аккаунта" onPress={() => handleLogout().catch(() => null)} />
    </ServiceScreen>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090B',
  },
  coverPreview: {
    borderRadius: 22,
    minHeight: 190,
    marginBottom: 14,
    overflow: 'hidden',
    backgroundColor: '#27272A',
    justifyContent: 'flex-end',
  },
  coverPreviewImage: {
    borderRadius: 22,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9,9,11,0.28)',
  },
  coverMeta: {
    padding: 18,
  },
  coverTitle: {
    color: '#F4F4F5',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },
  coverSubtitle: {
    color: '#E7E5E4',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    color: '#F4F4F5',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#09090B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#F4F4F5',
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
  toggleRow: {
    marginTop: 2,
    marginBottom: 14,
  },
  toggleLabel: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  toggleButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#111827',
    paddingVertical: 14,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#2D160B',
    borderColor: '#FB923C',
  },
  toggleButtonActiveMuted: {
    backgroundColor: '#2A1515',
    borderColor: '#7F1D1D',
  },
  toggleButtonText: {
    color: '#D4D4D8',
    fontSize: 14,
    fontWeight: '800',
  },
  toggleButtonTextActive: {
    color: '#FED7AA',
  },
  toggleButtonTextActiveMuted: {
    color: '#FECACA',
  },
});
