import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

type Props = NativeStackScreenProps<RootStackParamList, 'DriverProfile'>;

interface Car {
  make?: string;
  model?: string;
  color?: string;
  plateNumber?: string;
}

interface Document {
  id: string;
  type: 'DRIVER_LICENSE' | 'CAR_REGISTRATION' | 'TAXI_LICENSE' | 'OTHER';
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
}

const DOCUMENT_TYPES = {
  DRIVER_LICENSE: 'Водительское удостоверение',
  CAR_REGISTRATION: 'СТС',
  TAXI_LICENSE: 'Лицензия на такси',
  OTHER: 'Другой документ',
};

export const DriverProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [profile, setProfile] = useState<DriverProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [carMake, setCarMake] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carColor, setCarColor] = useState('');
  const [carPlate, setCarPlate] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [updatingIntercity, setUpdatingIntercity] = useState(false);
  const [updatingCourier, setUpdatingCourier] = useState(false);
  const [courierTransportType, setCourierTransportType] = useState<'CAR' | 'BIKE' | 'FOOT'>('FOOT');

  const approvedDocuments = profile?.documents?.filter((doc) => doc.approved) ?? [];
  const hasApprovedLicense = approvedDocuments.some((doc) => doc.type === 'DRIVER_LICENSE');
  const hasApprovedRegistration = approvedDocuments.some((doc) => doc.type === 'CAR_REGISTRATION');
  const hasCarInfo = !!(profile?.car?.make && profile?.car?.model && profile?.car?.color && profile?.car?.plateNumber);

  const nextSteps = [
    profile?.status !== 'APPROVED' ? 'Дождитесь одобрения аккаунта администратором.' : null,
    profile?.status === 'REJECTED' ? 'Проверьте документы и данные автомобиля, затем загрузите их заново.' : null,
    !hasCarInfo ? 'Заполните марку, модель, цвет и номер автомобиля.' : null,
    !hasApprovedLicense ? 'Загрузите водительское удостоверение и дождитесь проверки.' : null,
    !hasApprovedRegistration ? 'Загрузите СТС и дождитесь проверки.' : null,
  ].filter(Boolean) as string[];

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/drivers/profile');
      const data = res.data;
      setProfile(data);

      if (data.car) {
        setCarMake(data.car.make || '');
        setCarModel(data.car.model || '');
        setCarColor(data.car.color || '');
        setCarPlate(data.car.plateNumber || '');
      }
      if (data.courierTransportType) {
        setCourierTransportType(data.courierTransportType);
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить профиль');
    } finally {
      setLoading(false);
    }
  };

  const saveCar = async () => {
    if (!carMake.trim() || !carModel.trim() || !carColor.trim() || !carPlate.trim()) {
      Alert.alert('Ошибка', 'Заполните все поля автомобиля');
      return;
    }

    try {
      setSaving(true);
      await apiClient.post('/drivers/car', {
        make: carMake,
        model: carModel,
        color: carColor,
        plateNumber: carPlate,
      });
      Alert.alert('Успешно', 'Информация об автомобиле сохранена');
      loadProfile();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const toggleIntercity = async () => {
    try {
      setUpdatingIntercity(true);
      await apiClient.post('/drivers/intercity-capability', {
        supportsIntercity: !profile?.supportsIntercity,
      });
      await loadProfile();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось обновить межгородный режим');
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
        return 'На рассмотрении';
      case 'REJECTED':
        return 'Отклонён';
      default:
        return status;
    }
  };

  const getDocumentStatus = (doc: Document) => (doc.approved ? 'Одобрено' : 'Ожидает проверки');

  const pickAndUploadDocument = async (docType: 'DRIVER_LICENSE' | 'CAR_REGISTRATION') => {
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

        try {
          await apiClient.post('/drivers/documents', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          Alert.alert('Успешно', 'Документ отправлен на проверку');
          loadProfile();
        } catch (error: any) {
          Alert.alert('Ошибка', error?.response?.data?.message || 'Не удалось загрузить документ');
        } finally {
          setUploadingDoc(null);
        }
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось выбрать изображение');
      setUploadingDoc(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F4F4F5" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Профиль водителя</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>{getStatusText(profile?.status || 'PENDING')}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{Number(profile?.balance || 0).toFixed(0)} ₸</Text>
          <Text style={styles.statLabel}>Баланс</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile?.rating?.toFixed(1) || '5.0'} ★</Text>
          <Text style={styles.statLabel}>Рейтинг</Text>
        </View>
      </View>

      {profile ? (
        <View style={[styles.section, styles.statusSection, profile.status === 'APPROVED' ? styles.readySection : styles.warningSection]}>
          <Text style={styles.sectionTitle}>Статус выхода на линию</Text>
          <Text style={styles.statusSummary}>
            {profile.status === 'APPROVED' && hasCarInfo && hasApprovedLicense && hasApprovedRegistration
              ? 'Все готово. Можно выходить на линию.'
              : profile.status === 'REJECTED'
                ? 'Профиль отклонен. Исправьте данные и загрузите документы заново.'
                : 'Профиль еще не готов к выходу на линию. Ниже видно, чего не хватает.'}
          </Text>
          {nextSteps.map((step) => (
            <View key={step} style={styles.nextStepRow}>
              <Text style={styles.nextStepBullet}>•</Text>
              <Text style={styles.nextStepText}>{step}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Мой автомобиль</Text>
        <TextInput style={styles.input} placeholder="Марка" placeholderTextColor="#71717A" value={carMake} onChangeText={setCarMake} />
        <TextInput style={styles.input} placeholder="Модель" placeholderTextColor="#71717A" value={carModel} onChangeText={setCarModel} />
        <TextInput style={styles.input} placeholder="Цвет" placeholderTextColor="#71717A" value={carColor} onChangeText={setCarColor} />
        <TextInput style={styles.input} placeholder="Номер" placeholderTextColor="#71717A" value={carPlate} onChangeText={setCarPlate} autoCapitalize="characters" />
        <TouchableOpacity style={styles.primaryButton} onPress={saveCar} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? 'Сохранение...' : 'Сохранить автомобиль'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Документы</Text>
        <View style={styles.uploadButtonsContainer}>
          <TouchableOpacity
            style={[styles.secondaryButton, uploadingDoc === 'DRIVER_LICENSE' && styles.secondaryButtonDisabled]}
            onPress={() => pickAndUploadDocument('DRIVER_LICENSE')}
            disabled={uploadingDoc !== null}
          >
            <Text style={styles.secondaryButtonText}>
              {uploadingDoc === 'DRIVER_LICENSE' ? 'Загрузка...' : 'Водительское удостоверение'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, uploadingDoc === 'CAR_REGISTRATION' && styles.secondaryButtonDisabled]}
            onPress={() => pickAndUploadDocument('CAR_REGISTRATION')}
            disabled={uploadingDoc !== null}
          >
            <Text style={styles.secondaryButtonText}>
              {uploadingDoc === 'CAR_REGISTRATION' ? 'Загрузка...' : 'СТС'}
            </Text>
          </TouchableOpacity>
        </View>

        {profile?.documents && profile.documents.length > 0 ? (
          profile.documents.map((doc) => (
            <View key={doc.id} style={styles.documentCard}>
              <Text style={styles.documentType}>{DOCUMENT_TYPES[doc.type]}</Text>
              <Text style={styles.documentStatus}>{getDocumentStatus(doc)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Документы не загружены</Text>
        )}

        <View style={styles.documentNote}>
          <Text style={styles.noteText}>Выберите качественные фотографии документов. Их проверит администратор.</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Чек-лист для выхода на линию</Text>
        <View style={styles.checklist}>
          <View style={styles.checkItem}>
            <Text style={styles.checkIcon}>{profile?.status === 'APPROVED' ? '✓' : '•'}</Text>
            <Text style={styles.checkText}>Аккаунт одобрен администратором</Text>
          </View>
          <View style={styles.checkItem}>
            <Text style={styles.checkIcon}>{hasCarInfo ? '✓' : '•'}</Text>
            <Text style={styles.checkText}>Информация об автомобиле заполнена</Text>
          </View>
          <View style={styles.checkItem}>
            <Text style={styles.checkIcon}>{hasApprovedLicense ? '✓' : '•'}</Text>
            <Text style={styles.checkText}>Водительское удостоверение одобрено</Text>
          </View>
          <View style={styles.checkItem}>
            <Text style={styles.checkIcon}>{hasApprovedRegistration ? '✓' : '•'}</Text>
            <Text style={styles.checkText}>СТС одобрено</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Режимы водителя</Text>
        <View style={styles.checklist}>
          <View style={styles.checkItem}>
            <Text style={styles.checkIcon}>{profile?.supportsTaxi ? '✓' : '•'}</Text>
            <Text style={styles.checkText}>Такси доступно</Text>
          </View>
          <View style={styles.checkItem}>
            <Text style={styles.checkIcon}>{profile?.supportsIntercity ? '✓' : '•'}</Text>
            <Text style={styles.checkText}>Межгород {profile?.supportsIntercity ? 'включен' : 'выключен'}</Text>
          </View>
          <View style={styles.checkItem}>
            <Text style={styles.checkIcon}>{profile?.supportsCourier ? '✓' : '•'}</Text>
            <Text style={styles.checkText}>Курьер {profile?.supportsCourier ? `включен (${profile?.courierTransportType || 'FOOT'})` : 'выключен'}</Text>
          </View>
          <View style={styles.checkItem}>
            <Text style={styles.checkIcon}>•</Text>
            <Text style={styles.checkText}>Текущий режим: {profile?.driverMode === 'INTERCITY' ? 'Межгород' : profile?.driverMode === 'COURIER' ? 'Курьер' : 'Такси'}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.secondaryButton} onPress={toggleIntercity} disabled={updatingIntercity}>
          <Text style={styles.secondaryButtonText}>
            {updatingIntercity
              ? 'Обновление...'
              : profile?.supportsIntercity
                ? 'Выключить межгород'
                : 'Включить межгород'}
          </Text>
        </TouchableOpacity>
        <View style={styles.transportRow}>
          {(['FOOT', 'BIKE', 'CAR'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.transportChip, courierTransportType === type && styles.transportChipActive]}
              onPress={() => setCourierTransportType(type)}
            >
              <Text style={[styles.transportChipText, courierTransportType === type && styles.transportChipTextActive]}>
                {type === 'FOOT' ? 'Пеший' : type === 'BIKE' ? 'Байк' : 'Авто'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => toggleCourier(courierTransportType)}
          disabled={updatingCourier}
        >
          <Text style={styles.secondaryButtonText}>
            {updatingCourier
              ? 'Обновление...'
              : profile?.supportsCourier
                ? 'Выключить курьерский режим'
                : 'Включить курьерский режим'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  content: { paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090B' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, gap: 14 },
  backButton: { alignSelf: 'flex-start', backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  backButtonText: { color: '#A1A1AA', fontSize: 14, fontWeight: '600' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#F4F4F5' },
  statusBadge: { alignSelf: 'flex-start', backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  statusBadgeText: { color: '#A1A1AA', fontSize: 13, fontWeight: '700' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#18181B', padding: 18, borderRadius: 18, alignItems: 'center', borderWidth: 1, borderColor: '#27272A' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#F4F4F5', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#71717A', textTransform: 'uppercase' },
  section: { padding: 16, marginHorizontal: 16, marginBottom: 16, backgroundColor: '#18181B', borderRadius: 18, borderWidth: 1, borderColor: '#27272A' },
  statusSection: { marginTop: 0 },
  readySection: { borderColor: '#14532D', backgroundColor: '#0F1C14' },
  warningSection: { borderColor: '#3F3F46' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#F4F4F5', marginBottom: 16 },
  statusSummary: { fontSize: 14, color: '#E4E4E7', lineHeight: 20, marginBottom: 10 },
  nextStepRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 },
  nextStepBullet: { color: '#A1A1AA', fontSize: 16, marginRight: 8, lineHeight: 20 },
  nextStepText: { flex: 1, color: '#A1A1AA', fontSize: 13, lineHeight: 20 },
  input: { backgroundColor: '#09090B', color: '#F4F4F5', paddingHorizontal: 16, paddingVertical: 15, borderRadius: 16, marginBottom: 12, fontSize: 16, borderWidth: 1, borderColor: '#27272A' },
  primaryButton: { backgroundColor: '#F4F4F5', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  primaryButtonText: { color: '#000000', fontSize: 16, fontWeight: '800' },
  uploadButtonsContainer: { gap: 12, marginBottom: 16 },
  secondaryButton: { backgroundColor: '#09090B', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', borderWidth: 1, borderColor: '#27272A' },
  secondaryButtonDisabled: { opacity: 0.6 },
  secondaryButtonText: { color: '#F4F4F5', fontSize: 14, fontWeight: '700' },
  documentCard: { backgroundColor: '#09090B', padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#27272A' },
  documentType: { fontSize: 14, color: '#F4F4F5', marginBottom: 4, fontWeight: '600' },
  documentStatus: { fontSize: 12, color: '#A1A1AA' },
  emptyText: { fontSize: 14, color: '#71717A', textAlign: 'center', paddingVertical: 16 },
  documentNote: { backgroundColor: '#09090B', padding: 12, borderRadius: 14, marginTop: 12, borderWidth: 1, borderColor: '#27272A' },
  noteText: { fontSize: 12, color: '#71717A', lineHeight: 18 },
  checklist: { gap: 12 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkIcon: { fontSize: 18, color: '#F4F4F5', width: 18 },
  checkText: { fontSize: 14, color: '#F4F4F5', flex: 1 },
  transportRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12 },
  transportChip: {
    flex: 1,
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  transportChipActive: {
    backgroundColor: '#27272A',
  },
  transportChipText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
  },
  transportChipTextActive: {
    color: '#F4F4F5',
  },
});
