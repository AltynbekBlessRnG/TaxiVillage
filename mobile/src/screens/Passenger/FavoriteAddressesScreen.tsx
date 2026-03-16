import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { loadAuth } from '../../storage/authStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'FavoriteAddresses'>;

interface FavoriteAddress {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: string;
  updatedAt: string;
}

const PRESET_NAMES = ['Дом', 'Работа', 'Спортзал', 'Университет', 'Магазин'];

export const FavoriteAddressesScreen: React.FC<Props> = ({ navigation }) => {
  const [addresses, setAddresses] = useState<FavoriteAddress[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<FavoriteAddress | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    lat: 0,
    lng: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      const response = await apiClient.get('/favorite-addresses');
      setAddresses(response.data);
    } catch (error) {
      console.error('Failed to load favorite addresses:', error);
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
    Alert.alert(
      'Удаление адреса',
      `Удалить адрес "${address.name}"?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/favorite-addresses/${address.id}`);
              loadAddresses();
            } catch (error) {
              Alert.alert('Ошибка', 'Не удалось удалить адрес');
            }
          },
        },
      ]
    );
  };

  const handleSelectAddress = (address: FavoriteAddress) => {
    // Navigate back to home with selected address
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Избранные адреса</Text>
        <TouchableOpacity style={styles.addButton} onPress={openModal}>
          <Text style={styles.addButtonText}>+ Добавить</Text>
        </TouchableOpacity>
      </View>

      {/* Address List */}
      <ScrollView style={styles.list}>
        {addresses.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>У вас нет избранных адресов</Text>
            <Text style={styles.emptySubtext}>Добавьте адреса для быстрого заказа</Text>
          </View>
        ) : (
          addresses.map((address) => (
            <View key={address.id} style={styles.addressCard}>
              <TouchableOpacity
                style={styles.addressContent}
                onPress={() => handleSelectAddress(address)}
              >
                <View style={styles.addressInfo}>
                  <Text style={styles.addressName}>{address.name}</Text>
                  <Text style={styles.addressText}>{address.address}</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.addressActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => handleEdit(address)}
                >
                  <Text style={styles.editButtonText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(address)}
                >
                  <Text style={styles.deleteButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingAddress ? 'Редактировать адрес' : 'Добавить адрес'}
            </Text>

            {/* Preset Names */}
            <View style={styles.presetContainer}>
              <Text style={styles.presetLabel}>Быстрый выбор:</Text>
              <View style={styles.presetButtons}>
                {PRESET_NAMES.map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.presetButton,
                      formData.name === preset && styles.presetButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, name: preset })}
                  >
                    <Text style={[
                      styles.presetButtonText,
                      formData.name === preset && styles.presetButtonTextActive
                    ]}>{preset}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Название (Дом, Работа и т.д.)"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Адрес"
              value={formData.address}
              onChangeText={(text) => setFormData({ ...formData, address: text })}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelModalButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveModalButton, loading && styles.saveModalButtonDisabled]}
                onPress={handleSave}
                disabled={loading}
              >
                <Text style={styles.saveModalButtonText}>
                  {loading ? 'Сохранение...' : 'Сохранить'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  addButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    flex: 1,
    paddingHorizontal: 20,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  addressCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addressContent: {
    flex: 1,
  },
  addressInfo: {
    flex: 1,
  },
  addressName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  addressActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 16,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7F1D1D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    padding: 24,
    borderRadius: 24,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 20,
    textAlign: 'center',
  },
  presetContainer: {
    marginBottom: 20,
  },
  presetLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  presetButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
  },
  presetButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  presetButtonText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelModalButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
  },
  saveModalButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveModalButtonDisabled: {
    backgroundColor: '#475569',
  },
  presetButtonTextActive: {
  color: '#F8FAFC',
  fontWeight: '600',
},
  saveModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
  },
});
