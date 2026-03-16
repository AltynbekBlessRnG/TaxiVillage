import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
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
  uploadedAt: string;
}

interface DriverProfileData {
  fullName?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  balance?: number;
  rating?: number;
  car?: Car;
  documents?: Document[];
}

const DOCUMENT_TYPES = {
  DRIVER_LICENSE: 'Водительское удостоверение',
  CAR_REGISTRATION: 'СТС (Свидетельство о регистрации)',
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

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/drivers/profile');
      const data = res.data;
      setProfile(data);

      // Pre-fill car info if exists
      if (data.car) {
        setCarMake(data.car.make || '');
        setCarModel(data.car.model || '');
        setCarColor(data.car.color || '');
        setCarPlate(data.car.plateNumber || '');
      }
    } catch (e) {
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Text>✅ Одобрен</Text>;
      case 'PENDING':
        return <Text>⏳ На рассмотрении</Text>;
      case 'REJECTED':
        return <Text>❌ Отклонён</Text>;
      default:
        return <Text>{status}</Text>;
    }
  };

  const getDocumentStatus = (doc: Document) => {
    return doc.approved ? <Text>✅ Одобрено</Text> : <Text>⏳ Ожидает проверки</Text>;
  };

  const pickAndUploadDocument = async (docType: 'DRIVER_LICENSE' | 'CAR_REGISTRATION') => {
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        Alert.alert('Ошибка', 'Нужен доступ к галерее для загрузки документов');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingDoc(docType);
        
        // Create FormData
        const formData = new FormData();
        formData.append('type', docType);
        formData.append('file', {
          uri: result.assets[0].uri,
          type: 'image/jpeg',
          name: `${docType}_${Date.now()}.jpg`,
        } as any);

        // Upload to backend
        try {
          const response = await apiClient.post('/drivers/documents', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          
          Alert.alert('Успешно', 'Документ отправлен на проверку');
          loadProfile(); // Reload profile to show new document
        } catch (error: any) {
          Alert.alert('Ошибка', error?.response?.data?.message || 'Не удалось загрузить документ');
        } finally {
          setUploadingDoc(null);
        }
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выбрать изображение');
      setUploadingDoc(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>👤 Профиль водителя</Text>
        <Text style={styles.statusBadge}>{getStatusText(profile?.status || 'PENDING')}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{Number(profile?.balance || 0).toFixed(0)} ₸</Text>
          <Text style={styles.statLabel}>Баланс</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>⭐ {profile?.rating?.toFixed(1) || '5.0'}</Text>
          <Text style={styles.statLabel}>Рейтинг</Text>
        </View>
      </View>

      {/* Car Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}><Text>🚗 Мой автомобиль</Text></Text>

        <TextInput
          style={styles.input}
          placeholder="Марка (например: Toyota)"
          placeholderTextColor="#64748B"
          value={carMake}
          onChangeText={setCarMake}
        />
        <TextInput
          style={styles.input}
          placeholder="Модель (например: Camry)"
          placeholderTextColor="#64748B"
          value={carModel}
          onChangeText={setCarModel}
        />
        <TextInput
          style={styles.input}
          placeholder="Цвет (например: Чёрный)"
          placeholderTextColor="#64748B"
          value={carColor}
          onChangeText={setCarColor}
        />
        <TextInput
          style={styles.input}
          placeholder="Номер (например: А 123 БС 01)"
          placeholderTextColor="#64748B"
          value={carPlate}
          onChangeText={setCarPlate}
          autoCapitalize="characters"
        />

        <TouchableOpacity style={styles.button} onPress={saveCar} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? 'Сохранение...' : 'Сохранить автомобиль'}</Text>
        </TouchableOpacity>
      </View>

      {/* Documents Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}><Text>📄 Документы</Text></Text>

        {/* Upload Buttons */}
        <View style={styles.uploadButtonsContainer}>
          <TouchableOpacity
            style={[styles.uploadButton, uploadingDoc === 'DRIVER_LICENSE' && styles.uploadButtonDisabled]}
            onPress={() => pickAndUploadDocument('DRIVER_LICENSE')}
            disabled={uploadingDoc !== null}
          >
            <Text style={styles.uploadButtonText}>
              {uploadingDoc === 'DRIVER_LICENSE' ? 'Загрузка...' : '📷 Водительское удостоверение'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadButton, uploadingDoc === 'CAR_REGISTRATION' && styles.uploadButtonDisabled]}
            onPress={() => pickAndUploadDocument('CAR_REGISTRATION')}
            disabled={uploadingDoc !== null}
          >
            <Text style={styles.uploadButtonText}>
              {uploadingDoc === 'CAR_REGISTRATION' ? 'Загрузка...' : '📷 СТС'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Existing Documents */}
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
          <Text style={styles.noteText}>
            📸 Выберите качественные фотографии документов. Файлы будут проверены администратором.
          </Text>
        </View>
      </View>

      {/* Requirements Checklist */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}><Text>✅ Чек-лист для выхода на линию</Text></Text>

        <View style={styles.checklist}>
          <View style={styles.checkItem}>
            <Text style={styles.checkIcon}><Text>{profile?.status === 'APPROVED' ? '✅' : '❌'}</Text></Text>
            <Text style={styles.checkText}>Аккаунт одобрен администратором</Text>
          </View>

          <View style={styles.checkItem}>
            <Text style={styles.checkIcon}><Text>{profile?.car?.make && profile?.car?.model ? '✅' : '❌'}</Text></Text>
            <Text style={styles.checkText}>Информация об автомобиле заполнена</Text>
          </View>

          <View style={styles.checkItem}>
            <Text style={styles.checkIcon}><Text>{profile?.documents?.some((d) => d.type === 'DRIVER_LICENSE' && d.approved) ? '✅' : '❌'}</Text></Text>
            <Text style={styles.checkText}>Водительское удостоверение одобрено</Text>
          </View>

          <View style={styles.checkItem}>
            <Text style={styles.checkIcon}><Text>{profile?.documents?.some((d) => d.type === 'CAR_REGISTRATION' && d.approved) ? '✅' : '❌'}</Text></Text>
            <Text style={styles.checkText}>СТС одобрено</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  statusBadge: {
    fontSize: 14,
    color: '#94A3B8',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3B82F6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  section: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  buttonText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadButtonsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  uploadButton: {
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  uploadButtonDisabled: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
    opacity: 0.6,
  },
  uploadButtonText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  documentCard: {
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  documentType: {
    fontSize: 14,
    color: '#F8FAFC',
    marginBottom: 4,
  },
  documentStatus: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 16,
  },
  documentNote: {
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  noteText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  checklist: {
    gap: 12,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkIcon: {
    fontSize: 20,
  },
  checkText: {
    fontSize: 14,
    color: '#F8FAFC',
    flex: 1,
  },
  bottomSpace: {
    height: 40,
  },
});
