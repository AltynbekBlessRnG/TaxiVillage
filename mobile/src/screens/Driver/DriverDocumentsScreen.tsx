import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { showAlert } from '../../components/AppAlert';
import { OptionPickerModal } from '../../components/OptionPickerModal';
import { colors } from '../../theme/colors';

type UploadableDocumentType = 'DRIVER_LICENSE' | 'CAR_REGISTRATION' | 'COURIER_ID';
type DocumentSource = 'camera' | 'library';

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
  COURIER_ID: 'Удостоверение личности',
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

export const DriverDocumentsScreen: React.FC<Props> = ({ navigation, route }) => {
  const focusCar = route.params?.focus === 'car';
  const scrollRef = useRef<ScrollView>(null);
  const didScrollToCarRef = useRef(false);
  const [profile, setProfile] = useState<DriverDocumentsProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [documentSourceFor, setDocumentSourceFor] = useState<UploadableDocumentType | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCar, setSavingCar] = useState(false);
  const [fullName, setFullName] = useState('');
  const [carMake, setCarMake] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carColor, setCarColor] = useState('');
  const [carPlate, setCarPlate] = useState('');

  const documents = useMemo(() => profile?.documents ?? [], [profile?.documents]);
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
      showAlert('Ошибка', 'Не удалось загрузить документы водителя');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile().catch(() => null);
  }, [loadProfile]);

  const pickAndUploadDocument = useCallback(
    async (docType: UploadableDocumentType, source: DocumentSource) => {
      try {
        // Photographing the document is what people actually do - it is lying
        // on the table in front of them. Sending them to the gallery first
        // meant taking the picture in another app and coming back.
        const permissionResult =
          source === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.status !== 'granted') {
          showAlert(
            'Ошибка',
            source === 'camera'
              ? 'Нужен доступ к камере, чтобы сфотографировать документ'
              : 'Нужен доступ к галерее для загрузки документов',
          );
          return;
        }

        const pickerOptions = {
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3] as [number, number],
          quality: 0.8,
        };
        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync(pickerOptions)
            : await ImagePicker.launchImageLibraryAsync(pickerOptions);

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
          showAlert('Готово', 'Документ отправлен на проверку');
        }
      } catch (error: any) {
        showAlert('Ошибка', error?.response?.data?.message || 'Не удалось загрузить документ');
      } finally {
        setUploadingDoc(null);
      }
    },
    [loadProfile],
  );

  const saveBasicProfile = useCallback(async () => {
    if (!fullName.trim()) {
      showAlert('Ошибка', 'Укажи имя для профиля');
      return;
    }

    try {
      setSavingProfile(true);
      await apiClient.patch('/drivers/profile', { fullName: fullName.trim() });
      await loadProfile();
      showAlert('Готово', 'Имя профиля обновлено');
    } catch (error: any) {
      showAlert('Ошибка', error?.response?.data?.message || 'Не удалось обновить имя');
    } finally {
      setSavingProfile(false);
    }
  }, [fullName, loadProfile]);

  const saveCar = useCallback(async () => {
    if (!carMake.trim() || !carModel.trim() || !carColor.trim() || !carPlate.trim()) {
      showAlert('Ошибка', 'Заполните все поля автомобиля');
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
      if (focusCar) {
        // Came here only to add the car: go straight back to "Выйти на линию".
        navigation.goBack();
        return;
      }
      showAlert('Готово', 'Данные автомобиля обновлены');
    } catch (error: any) {
      showAlert('Ошибка', error?.response?.data?.message || 'Не удалось сохранить автомобиль');
    } finally {
      setSavingCar(false);
    }
  }, [carColor, carMake, carModel, carPlate, focusCar, loadProfile, navigation]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.text} />
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
          ref={scrollRef}
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
              Редактируйте профиль и загружайте документы
            </Text>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{documents.length}</Text>
                <Text style={styles.heroStatLabel}>Загружено</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatValue, { color: colors.successText }]}>{approvedCount}</Text>
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
              placeholderTextColor={colors.textTertiary}
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

          <View
            style={[styles.section, focusCar && styles.sectionFocused]}
            onLayout={(event) => {
              if (focusCar && !didScrollToCarRef.current) {
                didScrollToCarRef.current = true;
                scrollRef.current?.scrollTo({ y: Math.max(event.nativeEvent.layout.y - 12, 0), animated: true });
              }
            }}
          >
            <Text style={styles.sectionTitle}>Автомобиль</Text>
            <Text style={styles.sectionSubtitle}>
              {focusCar
                ? 'Осталось добавить машину — и можно выходить на линию. Пассажиры увидят марку, цвет и номер, чтобы найти вас.'
                : 'Эти данные нужны для такси, межгорода и автокурьера.'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Марка"
              placeholderTextColor={colors.textTertiary}
              value={carMake}
              onChangeText={setCarMake}
            />
            <TextInput
              style={styles.input}
              placeholder="Модель"
              placeholderTextColor={colors.textTertiary}
              value={carModel}
              onChangeText={setCarModel}
            />
            <TextInput
              style={styles.input}
              placeholder="Цвет"
              placeholderTextColor={colors.textTertiary}
              value={carColor}
              onChangeText={setCarColor}
            />
            <TextInput
              style={styles.input}
              placeholder="Номер"
              placeholderTextColor={colors.textTertiary}
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
                {savingCar ? 'Сохраняем...' : focusCar ? 'Сохранить и вернуться' : 'Сохранить автомобиль'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Быстрые действия</Text>
            <Text style={styles.sectionSubtitle}>
              Права и СТС проверяет администратор. После проверки пассажиры видят у вас отметку «Документы проверены».
            </Text>

            <View style={styles.uploadGrid}>
              <UploadAction
                title="Водительское удостоверение"
                subtitle="Для режима такси"
                onPress={() => setDocumentSourceFor('DRIVER_LICENSE')}
                disabled={uploadingDoc !== null}
                busy={uploadingDoc === 'DRIVER_LICENSE'}
              />
              <UploadAction
                title="СТС"
                subtitle="Для такси и авто-режимов"
                onPress={() => setDocumentSourceFor('CAR_REGISTRATION')}
                disabled={uploadingDoc !== null}
                busy={uploadingDoc === 'CAR_REGISTRATION'}
              />
              <UploadAction
                title="Удостоверение личности"
                subtitle="Для курьерского режима"
                onPress={() => setDocumentSourceFor('COURIER_ID')}
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

      <OptionPickerModal
        visible={documentSourceFor !== null}
        title="Как загрузить документ?"
        options={[
          { label: 'Сфотографировать', value: 'camera' },
          { label: 'Выбрать из галереи', value: 'library' },
        ]}
        onSelect={(value) => {
          if (documentSourceFor) {
            void pickAndUploadDocument(documentSourceFor, value as DocumentSource);
          }
        }}
        onClose={() => setDocumentSourceFor(null)}
      />
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
  heroTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: colors.textSecondary,
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
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  heroStatValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  heroStatLabel: {
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
  sectionFocused: {
    borderColor: colors.accentBorder,
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
  uploadGrid: {
    gap: 10,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  staticMetaLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 8,
  },
  staticMetaCard: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 12,
  },
  staticMetaText: {
    color: colors.text,
    fontSize: 16,
  },
  input: {
    backgroundColor: colors.bg,
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 16,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryButton: {
    backgroundColor: colors.surfaceInverse,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '900',
  },
  uploadAction: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  uploadActionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  uploadActionSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  documentsList: {
    gap: 10,
  },
  documentRow: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  documentUrl: {
    color: colors.textTertiary,
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
    backgroundColor: colors.successSurface,
    borderColor: colors.successBorder,
  },
  documentStatusPending: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
  },
  documentStatusText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  documentStatusTextApproved: {
    color: colors.successText,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
