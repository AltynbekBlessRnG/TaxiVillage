import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import {
  formatGooglePredictionAddress,
  getGooglePlaceDetails,
  searchGooglePlaces,
} from '../../utils/googleMaps';

type Props = NativeStackScreenProps<RootStackParamList, 'FavoriteAddresses'>;

interface FavoriteAddress {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface GooglePlacePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

const PRESET_NAMES = ['Дом', 'Работа', 'Спортзал', 'Университет', 'Магазин'];

const hasValidCoordinates = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);

export const FavoriteAddressesScreen: React.FC<Props> = ({ navigation }) => {
  const [addresses, setAddresses] = useState<FavoriteAddress[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<FavoriteAddress | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '', lat: 0, lng: 0 });
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<GooglePlacePrediction[]>([]);

  const loadAddresses = useCallback(async () => {
    try {
      const response = await apiClient.get('/favorite-addresses');
      setAddresses(response.data);
    } catch {
      setAddresses([]);
    }
  }, []);

  useEffect(() => {
    loadAddresses().catch(() => {});
  }, [loadAddresses]);

  useEffect(() => {
    if (!showModal) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const query = formData.address.trim();
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await searchGooglePlaces(query);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [formData.address, showModal]);

  const resetModal = () => {
    setShowModal(false);
    setEditingAddress(null);
    setFormData({ name: '', address: '', lat: 0, lng: 0 });
    setSearchResults([]);
    setSearchLoading(false);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.address.trim()) {
      Alert.alert('Ошибка', 'Заполните название и адрес');
      return;
    }

    if (!hasValidCoordinates(formData.lat, formData.lng)) {
      Alert.alert('Нужна точка', 'Выберите адрес из подсказок Google. Сохранять адрес без координат нельзя.');
      return;
    }

    setLoading(true);
    try {
      if (editingAddress) {
        await apiClient.patch(`/favorite-addresses/${editingAddress.id}`, formData);
      } else {
        await apiClient.post('/favorite-addresses', formData);
      }

      resetModal();
      await loadAddresses();
    } catch (error: any) {
      Alert.alert('Ошибка', error.response?.data?.message || 'Не удалось сохранить адрес');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (address: FavoriteAddress) => {
    setEditingAddress(address);
    setFormData({
      name: address.name,
      address: address.address,
      lat: address.lat,
      lng: address.lng,
    });
    setShowModal(true);
  };

  const handleDelete = (address: FavoriteAddress) => {
    Alert.alert('Удаление адреса', `Удалить адрес "${address.name}"?`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/favorite-addresses/${address.id}`);
            await loadAddresses();
          } catch {
            Alert.alert('Ошибка', 'Не удалось удалить адрес');
          }
        },
      },
    ]);
  };

  const handleSelectAddress = (address: FavoriteAddress) => {
    navigation.navigate('PassengerHome', {
      selectedAddress: {
        address: address.address,
        lat: address.lat,
        lng: address.lng,
      },
    });
  };

  const openModal = () => {
    setEditingAddress(null);
    setFormData({ name: '', address: '', lat: 0, lng: 0 });
    setShowModal(true);
  };

  const handleAddressInputChange = (text: string) => {
    setFormData((current) => ({
      ...current,
      address: text,
      lat: 0,
      lng: 0,
    }));
  };

  const handleSuggestionPress = async (prediction: GooglePlacePrediction) => {
    setSearchLoading(true);
    try {
      const location = await getGooglePlaceDetails(prediction.place_id);
      setFormData((current) => ({
        ...current,
        address: formatGooglePredictionAddress(prediction),
        lat: location.lat,
        lng: location.lng,
      }));
      setSearchResults([]);
    } catch {
      Alert.alert('Ошибка', 'Не удалось получить координаты адреса');
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Мои адреса</Text>
        <TouchableOpacity style={styles.addButton} onPress={openModal}>
          <Text style={styles.addButtonText}>+ Добавить</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {addresses.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>У вас нет избранных адресов</Text>
            <Text style={styles.emptySubtext}>Добавьте точки для быстрого заказа.</Text>
          </View>
        ) : (
          addresses.map((address) => (
            <View key={address.id} style={styles.addressCard}>
              <TouchableOpacity style={styles.addressContent} onPress={() => handleSelectAddress(address)}>
                <Text style={styles.addressName}>{address.name}</Text>
                <Text style={styles.addressText}>{address.address}</Text>
              </TouchableOpacity>
              <View style={styles.addressActions}>
                <TouchableOpacity style={styles.iconButton} onPress={() => handleEdit(address)}>
                  <Text style={styles.iconButtonText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconButton, styles.deleteButton]} onPress={() => handleDelete(address)}>
                  <Text style={styles.iconButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={resetModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingAddress ? 'Редактировать адрес' : 'Добавить адрес'}</Text>
            <Text style={styles.presetLabel}>Быстрый выбор</Text>
            <View style={styles.presetButtons}>
              {PRESET_NAMES.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[styles.presetButton, formData.name === preset && styles.presetButtonActive]}
                  onPress={() => setFormData((current) => ({ ...current, name: preset }))}
                >
                  <Text style={[styles.presetButtonText, formData.name === preset && styles.presetButtonTextActive]}>{preset}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Название"
              placeholderTextColor="#71717A"
              value={formData.name}
              onChangeText={(text) => setFormData((current) => ({ ...current, name: text }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Найдите адрес через Google"
              placeholderTextColor="#71717A"
              value={formData.address}
              onChangeText={handleAddressInputChange}
            />

            <View style={styles.coordinateHint}>
              <Text style={styles.coordinateHintText}>
                {hasValidCoordinates(formData.lat, formData.lng)
                  ? 'Точка выбрана. Адрес можно сохранять.'
                  : 'Сначала выберите адрес из подсказок ниже.'}
              </Text>
            </View>

            {searchLoading ? (
              <View style={styles.searchLoading}>
                <ActivityIndicator color="#F4F4F5" size="small" />
                <Text style={styles.searchLoadingText}>Ищем адрес...</Text>
              </View>
            ) : null}

            {searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.place_id}
                style={styles.suggestionsList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.suggestionItem} onPress={() => void handleSuggestionPress(item)}>
                    <Text style={styles.suggestionTitle}>
                      {item.structured_formatting?.main_text || item.description}
                    </Text>
                    {item.structured_formatting?.secondary_text ? (
                      <Text style={styles.suggestionSubtitle}>{item.structured_formatting.secondary_text}</Text>
                    ) : null}
                  </TouchableOpacity>
                )}
              />
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelModalButton} onPress={resetModal}>
                <Text style={styles.cancelModalButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveModalButton, loading && styles.saveModalButtonDisabled]}
                onPress={handleSave}
                disabled={loading}
              >
                <Text style={styles.saveModalButtonText}>{loading ? 'Сохранение...' : 'Сохранить'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButtonText: { color: '#A1A1AA', fontSize: 14, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', color: '#F4F4F5' },
  addButton: { backgroundColor: '#F4F4F5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  addButtonText: { color: '#000000', fontSize: 14, fontWeight: '800' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 28 },
  empty: { marginTop: 100, alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#F4F4F5', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#71717A', textAlign: 'center' },
  addressCard: {
    backgroundColor: '#18181B',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addressContent: { flex: 1, paddingRight: 12 },
  addressName: { fontSize: 16, fontWeight: '700', color: '#F4F4F5', marginBottom: 6 },
  addressText: { fontSize: 14, color: '#A1A1AA', lineHeight: 20 },
  addressActions: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#27272A', justifyContent: 'center', alignItems: 'center' },
  deleteButton: { backgroundColor: '#3F1D1D' },
  iconButtonText: { fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: {
    backgroundColor: '#18181B',
    padding: 24,
    borderRadius: 24,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#27272A',
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#F4F4F5', marginBottom: 18, textAlign: 'center' },
  presetLabel: { color: '#71717A', fontSize: 13, marginBottom: 10, textTransform: 'uppercase' },
  presetButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  presetButton: { backgroundColor: '#09090B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#27272A' },
  presetButtonActive: { backgroundColor: '#27272A' },
  presetButtonText: { fontSize: 12, color: '#A1A1AA', fontWeight: '600' },
  presetButtonTextActive: { color: '#F4F4F5' },
  input: {
    backgroundColor: '#09090B',
    color: '#F4F4F5',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 12,
  },
  coordinateHint: {
    backgroundColor: '#09090B',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 12,
  },
  coordinateHintText: { color: '#A1A1AA', fontSize: 13, lineHeight: 18 },
  searchLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  searchLoadingText: { color: '#A1A1AA', marginLeft: 8, fontSize: 13 },
  suggestionsList: {
    maxHeight: 220,
    backgroundColor: '#09090B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 14,
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  suggestionTitle: { color: '#F4F4F5', fontSize: 15, fontWeight: '600' },
  suggestionSubtitle: { color: '#71717A', fontSize: 12, marginTop: 4 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 10 },
  cancelModalButton: { flex: 1, backgroundColor: '#27272A', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  cancelModalButtonText: { fontSize: 16, fontWeight: '700', color: '#A1A1AA' },
  saveModalButton: { flex: 1, backgroundColor: '#F4F4F5', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  saveModalButtonDisabled: { opacity: 0.6 },
  saveModalButtonText: { fontSize: 16, fontWeight: '800', color: '#000000' },
});
