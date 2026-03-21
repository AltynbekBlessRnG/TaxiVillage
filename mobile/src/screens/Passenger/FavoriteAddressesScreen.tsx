import React, { useEffect, useState } from 'react';
import {
  Alert,
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

type Props = NativeStackScreenProps<RootStackParamList, 'FavoriteAddresses'>;

interface FavoriteAddress {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const PRESET_NAMES = ['Дом', 'Работа', 'Спортзал', 'Университет', 'Магазин'];

export const FavoriteAddressesScreen: React.FC<Props> = ({ navigation }) => {
  const [addresses, setAddresses] = useState<FavoriteAddress[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<FavoriteAddress | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '', lat: 0, lng: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      const response = await apiClient.get('/favorite-addresses');
      setAddresses(response.data);
    } catch {
      setAddresses([]);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.address.trim()) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }

    setLoading(true);
    try {
      if (editingAddress) {
        await apiClient.patch(`/favorite-addresses/${editingAddress.id}`, formData);
      } else {
        await apiClient.post('/favorite-addresses', formData);
      }

      setShowModal(false);
      setEditingAddress(null);
      setFormData({ name: '', address: '', lat: 0, lng: 0 });
      loadAddresses();
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
            loadAddresses();
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

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingAddress ? 'Редактировать адрес' : 'Добавить адрес'}</Text>
            <Text style={styles.presetLabel}>Быстрый выбор</Text>
            <View style={styles.presetButtons}>
              {PRESET_NAMES.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[styles.presetButton, formData.name === preset && styles.presetButtonActive]}
                  onPress={() => setFormData({ ...formData, name: preset })}
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
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Адрес"
              placeholderTextColor="#71717A"
              value={formData.address}
              onChangeText={(text) => setFormData({ ...formData, address: text })}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelModalButton} onPress={() => setShowModal(false)}>
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
    marginBottom: 14,
  },
  multilineInput: { minHeight: 90, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 10 },
  cancelModalButton: { flex: 1, backgroundColor: '#27272A', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  cancelModalButtonText: { fontSize: 16, fontWeight: '700', color: '#A1A1AA' },
  saveModalButton: { flex: 1, backgroundColor: '#F4F4F5', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  saveModalButtonDisabled: { opacity: 0.6 },
  saveModalButtonText: { fontSize: 16, fontWeight: '800', color: '#000000' },
});
