import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverDocuments'>;

interface DocumentItem {
  id: string;
  type: 'DRIVER_LICENSE' | 'CAR_REGISTRATION' | 'TAXI_LICENSE' | 'COURIER_ID' | 'OTHER';
  url: string;
  approved: boolean;
}

interface DriverDocumentsProfile {
  fullName?: string;
  user?: { phone?: string };
  car?: {
    make?: string;
    model?: string;
    color?: string;
    plateNumber?: string;
  };
  documents?: DocumentItem[];
}

const DOCUMENT_TYPES = {
  DRIVER_LICENSE: 'Водительское удостоверение',
  CAR_REGISTRATION: 'СТС',
  TAXI_LICENSE: 'Лицензия такси',
  COURIER_ID: 'ID курьера',
  OTHER: 'Другой документ',
} as const;

const UploadAction: React.FC<{
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}> = ({ title, subtitle, onPress, disabled = false, busy = false }) => (
  <TouchableOpacity
    style={[styles.uploadAction, disabled && styles.disabledButton]}
    onPress={onPress}
    disabled={disabled}
  >
    <Text style={styles.uploadActionTitle}>{busy ? 'Загрузка...' : title}</Text>
    <Text style={styles.uploadActionSubtitle}>{subtitle}</Text>
  </TouchableOpacity>
);

export const DriverDocumentsScreen: React.FC<Props> = ({ navigation }) => {
  const [profile, setProfile] = useState<DriverDocumentsProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCar, setSavingCar] = useState(false);
  const [fullName, setFullName] = useState('');
  const [carMake, setCarMake] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carColor, setCarColor] = useState('');
  const [carPlate, setCarPlate] = useState('');

  const documents = profile?.documents ?? [];
  const approvedCount = useMemo(
    () => documents.filter((doc) => doc.approved).length,
    [documents],
  );

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/drivers/profile');
      const nextProfile = response.data;
      setProfile(nextProfile);
      setFullName(nextProfile.fullName || '');
      setCarMake(nextProfile.car?.make || '');
      setCarModel(nextProfile.car?.model || '');
      setCarColor(nextProfile.car?.color || '');
      setCarPlate(nextProfile.car?.plateNumber || '');
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить документы водителя');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile().catch(() => null);
  }, [loadProfile]);

  const pickAndUploadDocument = useCallback(
    async (docType: 'DRIVER_LICENSE' | 'CAR_REGISTRATION' | 'COURIER_ID') => {
      try {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.status !== 'granted') {
          Alert.alert('Ошибка', 'Нужен доступ к галерее для загрузки документов');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
          setUploadingDoc(docType);
          const formData = new FormData();
          formData.append('type', docType);
          formData.append('file', {
            uri: result.assets[0].uri,
            type: 'image/jpeg',
            name: `${docType}_${Date.now()}.jpg`,
          } as any);

          await apiClient.post('/drivers/documents', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          await loadProfile();
          Alert.alert('Готово', 'Документ отправлен на проверку');
        }
      } catch (error: any) {
        Alert.alert('Ошибка', error?.response?.data?.message || 'Не удалось загрузить документ');
      } finally {
        setUploadingDoc(null);
      }
    },
    [loadProfile],
  );

  const saveBasicProfile = useCallback(async () => {
    if (!fullName.trim()) {
      Alert.alert('Ошибка', 'Укажи имя для профиля');
      return;
    }

    try {
      setSavingProfile(true);
      await apiClient.patch('/drivers/profile', { fullName: fullName.trim() });
      await loadProfile();
      Alert.alert('Готово', 'Имя профиля обновлено');
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.message || 'Не удалось обновить имя');
    } finally {
      setSavingProfile(false);
    }
  }, [fullName, loadProfile]);

  const saveCar = useCallback(async () => {
    if (!carMake.trim() || !carModel.trim() || !carColor.trim() || !carPlate.trim()) {
      Alert.alert('Ошибка', 'Заполните все поля автомобиля');
      return;
    }

    try {
      setSavingCar(true);
      await apiClient.post('/drivers/car', {
        make: carMake.trim(),
        model: carModel.trim(),
        color: carColor.trim(),
        plateNumber: carPlate.trim().toUpperCase(),
      });
      await loadProfile();
      Alert.alert('Готово', 'Данные автомобиля обновлены');
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.message || 'Не удалось сохранить автомобиль');
    } finally {
      setSavingCar(false);
    }
  }, [carColor, carMake, carModel, carPlate, loadProfile]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F4F4F5" />
      </View>
    );
  }

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
            <Text style={styles.heroTitle}>Данные и документы</Text>
            <Text style={styles.heroSubtitle}>
              Здесь удобно редактировать имя, смотреть телефон, обновлять автомобиль и загружать документы без длинной прокрутки основного профиля.
            </Text>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{documents.length}</Text>
                <Text style={styles.heroStatLabel}>Загружено</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatValue, { color: '#86EFAC' }]}>{approvedCount}</Text>
                <Text style={styles.heroStatLabel}>Одобрено</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Данные водителя</Text>
            <Text style={styles.sectionSubtitle}>
              Эти данные видят пассажиры в рабочих сценариях.
            </Text>
            <Text style={styles.label}>Имя профиля</Text>
            <TextInput
              style={styles.input}
              placeholder="Как тебя показать в профиле"
              placeholderTextColor="#71717A"
              value={fullName}
              onChangeText={setFullName}
            />
            <Text style={styles.staticMetaLabel}>Телефон</Text>
            <View style={styles.staticMetaCard}>
              <Text style={styles.staticMetaText}>{profile?.user?.phone || 'Телефон не найден'}</Text>
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, savingProfile && styles.disabledButton]}
              onPress={() => saveBasicProfile().catch(() => null)}
              disabled={savingProfile}
            >
              <Text style={styles.primaryButtonText}>
                {savingProfile ? 'Сохраняем...' : 'Сохранить данные водителя'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Автомобиль</Text>
            <Text style={styles.sectionSubtitle}>
              Эти данные нужны для такси, межгорода и автокурьера.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Марка"
              placeholderTextColor="#71717A"
              value={carMake}
              onChangeText={setCarMake}
            />
            <TextInput
              style={styles.input}
              placeholder="Модель"
              placeholderTextColor="#71717A"
              value={carModel}
              onChangeText={setCarModel}
            />
            <TextInput
              style={styles.input}
              placeholder="Цвет"
              placeholderTextColor="#71717A"
              value={carColor}
              onChangeText={setCarColor}
            />
            <TextInput
              style={styles.input}
              placeholder="Номер"
              placeholderTextColor="#71717A"
              value={carPlate}
              onChangeText={setCarPlate}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[styles.primaryButton, savingCar && styles.disabledButton]}
              onPress={() => saveCar().catch(() => null)}
              disabled={savingCar}
            >
              <Text style={styles.primaryButtonText}>
                {savingCar ? 'Сохраняем...' : 'Сохранить автомобиль'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Быстрые действия</Text>
            <Text style={styles.sectionSubtitle}>
              Сначала загрузи документы, потом администратор проверит их и допустит к работе.
            </Text>

            <View style={styles.uploadGrid}>
              <UploadAction
                title="Водительское удостоверение"
                subtitle="Для режима такси"
                onPress={() => pickAndUploadDocument('DRIVER_LICENSE')}
                disabled={uploadingDoc !== null}
                busy={uploadingDoc === 'DRIVER_LICENSE'}
              />
              <UploadAction
                title="СТС"
                subtitle="Для такси и авто-режимов"
                onPress={() => pickAndUploadDocument('CAR_REGISTRATION')}
                disabled={uploadingDoc !== null}
                busy={uploadingDoc === 'CAR_REGISTRATION'}
              />
              <UploadAction
                title="ID курьера"
                subtitle="Для курьерского режима"
                onPress={() => pickAndUploadDocument('COURIER_ID')}
                disabled={uploadingDoc !== null}
                busy={uploadingDoc === 'COURIER_ID'}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Загруженные документы</Text>
            {documents.length ? (
              <View style={styles.documentsList}>
                {documents.map((doc) => (
                  <View key={doc.id} style={styles.documentRow}>
                    <View style={styles.documentLeft}>
                      <TouchableOpacity
                        style={styles.documentPreview}
                        onPress={() => Linking.openURL(doc.url).catch(() => null)}
                        activeOpacity={0.85}
                      >
                        <Image source={{ uri: doc.url }} style={styles.documentImage} />
                      </TouchableOpacity>
                      <View style={styles.documentMeta}>
                        <Text style={styles.documentName}>{DOCUMENT_TYPES[doc.type]}</Text>
                        <Text style={styles.documentUrl} numberOfLines={1}>
                          {doc.url}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.documentStatusPill,
                        doc.approved ? styles.documentStatusApproved : styles.documentStatusPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.documentStatusText,
                          doc.approved && styles.documentStatusTextApproved,
                        ]}
                      >
                        {doc.approved ? 'Одобрен' : 'На проверке'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Пока нет загруженных документов</Text>
              </View>
            )}
          </View>
        </ScrollView>
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
  heroTitle: {
    color: '#F4F4F5',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#A1A1AA',
    fontSize: 14,
    lineHeight: 20,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  heroStat: {
    flex: 1,
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 14,
  },
  heroStatValue: {
    color: '#F4F4F5',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  heroStatLabel: {
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
  uploadGrid: {
    gap: 10,
  },
  label: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  staticMetaLabel: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 8,
  },
  staticMetaCard: {
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 12,
  },
  staticMetaText: {
    color: '#F4F4F5',
    fontSize: 16,
  },
  input: {
    backgroundColor: '#09090B',
    color: '#F4F4F5',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 16,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#27272A',
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
  uploadAction: {
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 14,
  },
  uploadActionTitle: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  uploadActionSubtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 18,
  },
  documentsList: {
    gap: 10,
  },
  documentRow: {
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  documentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  documentPreview: {
    width: 58,
    height: 58,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    marginRight: 12,
  },
  documentImage: {
    width: '100%',
    height: '100%',
  },
  documentMeta: {
    flex: 1,
  },
  documentName: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  documentUrl: {
    color: '#71717A',
    fontSize: 12,
    maxWidth: 200,
  },
  documentStatusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  documentStatusApproved: {
    backgroundColor: '#0F2A1C',
    borderColor: '#14532D',
  },
  documentStatusPending: {
    backgroundColor: '#18181B',
    borderColor: '#3F3F46',
  },
  documentStatusText: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '800',
  },
  documentStatusTextApproved: {
    color: '#86EFAC',
  },
  emptyCard: {
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 18,
    alignItems: 'center',
  },
  emptyText: {
    color: '#71717A',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
