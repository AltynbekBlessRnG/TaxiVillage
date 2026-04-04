import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { apiClient } from '../../api/client';
import {
  InlineLabel,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'MenuEditor'>;

export const MenuEditorScreen: React.FC<Props> = () => {
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [reorderingCategoryId, setReorderingCategoryId] = useState<string | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [reorderingItemId, setReorderingItemId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/merchants/profile/me');
      setMerchant(response.data);
      if (!selectedCategoryId && response.data?.menuCategories?.length) {
        setSelectedCategoryId(response.data.menuCategories[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    loadProfile().catch(() => null);
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      loadProfile().catch(() => null);
    }, [loadProfile]),
  );

  const selectedCategory = useMemo(
    () => merchant?.menuCategories?.find((category: any) => category.id === selectedCategoryId) ?? null,
    [merchant, selectedCategoryId],
  );

  const createCategory = async () => {
    if (!categoryName.trim()) {
      Alert.alert('Нужна категория', 'Укажи название категории меню.');
      return;
    }

    try {
      setCreatingCategory(true);
      const response = await apiClient.post('/merchants/menu/categories', { name: categoryName.trim() });
      setCategoryName('');
      setSelectedCategoryId(response.data.id);
      await loadProfile();
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.message || 'Не удалось создать категорию');
    } finally {
      setCreatingCategory(false);
    }
  };

  const startEditingCategory = (category: any) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name || '');
  };

  const cancelEditingCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };

  const saveCategory = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) {
      Alert.alert('Нужна категория', 'Укажи новое название категории.');
      return;
    }

    try {
      setSavingCategoryId(editingCategoryId);
      await apiClient.patch(`/merchants/menu/categories/${editingCategoryId}`, {
        name: editingCategoryName.trim(),
      });
      cancelEditingCategory();
      await loadProfile();
      Alert.alert('Готово', 'Категория обновлена');
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.message || 'Не удалось обновить категорию');
    } finally {
      setSavingCategoryId(null);
    }
  };

  const deleteCategory = async (categoryId: string) => {
    try {
      setDeletingCategoryId(categoryId);
      await apiClient.delete(`/merchants/menu/categories/${categoryId}`);
      if (editingCategoryId === categoryId) {
        cancelEditingCategory();
      }
      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId(null);
      }
      await loadProfile();
      Alert.alert('Готово', 'Категория удалена');
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.message || 'Не удалось удалить категорию');
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const reorderCategory = async (categoryId: string, direction: 'up' | 'down') => {
    try {
      setReorderingCategoryId(categoryId);
      await apiClient.post(`/merchants/menu/categories/${categoryId}/reorder`, { direction });
      await loadProfile();
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.message || 'Не удалось изменить порядок категории');
    } finally {
      setReorderingCategoryId(null);
    }
  };

  const pickAndUploadItemImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Нужен доступ', 'Разреши доступ к галерее, чтобы загрузить фото блюда.');
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

      setUploadingImage(true);
      const formData = new FormData();
      formData.append('file', {
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: `menu_item_${Date.now()}.jpg`,
      } as any);

      const response = await apiClient.post('/merchants/menu/items/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setItemImageUrl(response.data.url);
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.message || 'Не удалось загрузить фото блюда');
    } finally {
      setUploadingImage(false);
    }
  };

  const createItem = async () => {
    if (!selectedCategoryId) {
      Alert.alert('Сначала категория', 'Выбери категорию, в которую нужно добавить блюдо.');
      return;
    }

    if (!itemName.trim() || !itemPrice.trim()) {
      Alert.alert('Не хватает данных', 'Укажи название и цену блюда.');
      return;
    }

    try {
      setCreatingItem(true);
      if (editingItemId) {
        await apiClient.patch(`/merchants/menu/items/${editingItemId}`, {
          categoryId: selectedCategoryId,
          name: itemName.trim(),
          description: itemDescription.trim() || undefined,
          price: Number(itemPrice),
          imageUrl: itemImageUrl || undefined,
        });
      } else {
        await apiClient.post('/merchants/menu/items', {
          categoryId: selectedCategoryId,
          name: itemName.trim(),
          description: itemDescription.trim() || undefined,
          price: Number(itemPrice),
          imageUrl: itemImageUrl || undefined,
        });
      }
      setItemName('');
      setItemDescription('');
      setItemPrice('');
      setItemImageUrl('');
      setEditingItemId(null);
      await loadProfile();
      Alert.alert('Готово', editingItemId ? 'Блюдо обновлено' : 'Блюдо добавлено в меню');
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.message || 'Не удалось сохранить блюдо');
    } finally {
      setCreatingItem(false);
    }
  };

  const startEditingItem = (item: any, categoryId: string) => {
    setEditingItemId(item.id);
    setSelectedCategoryId(categoryId);
    setItemName(item.name || '');
    setItemDescription(item.description || '');
    setItemPrice(item.price ? String(Math.round(Number(item.price))) : '');
    setItemImageUrl(item.imageUrl || '');
  };

  const resetItemForm = () => {
    setEditingItemId(null);
    setItemName('');
    setItemDescription('');
    setItemPrice('');
    setItemImageUrl('');
  };

  const deleteItem = async (itemId: string) => {
    try {
      setDeletingItemId(itemId);
      await apiClient.delete(`/merchants/menu/items/${itemId}`);
      if (editingItemId === itemId) {
        resetItemForm();
      }
      await loadProfile();
      Alert.alert('Готово', 'Блюдо удалено');
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.message || 'Не удалось удалить блюдо');
    } finally {
      setDeletingItemId(null);
    }
  };

  const reorderItem = async (itemId: string, direction: 'up' | 'down') => {
    try {
      setReorderingItemId(itemId);
      await apiClient.post(`/merchants/menu/items/${itemId}/reorder`, { direction });
      await loadProfile();
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.message || 'Не удалось изменить порядок блюда');
    } finally {
      setReorderingItemId(null);
    }
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
      eyebrow="Меню"
      title="Редактор меню"
      subtitle="Категории, блюда и фото в одном месте без техничного вида."
    >
      <ServiceCard>
        <SectionTitle>Новая категория</SectionTitle>
        <TextInput
          value={categoryName}
          onChangeText={setCategoryName}
          style={styles.input}
          placeholder="Например, Донеры"
          placeholderTextColor="#71717A"
        />
        <PrimaryButton
          title={creatingCategory ? 'Создаем категорию...' : 'Создать категорию'}
          onPress={() => createCategory().catch(() => null)}
        />
        {editingCategoryId ? (
          <View style={styles.categoryEditorCard}>
            <Text style={styles.categoryEditorTitle}>Редактирование категории</Text>
            <TextInput
              value={editingCategoryName}
              onChangeText={setEditingCategoryName}
              style={styles.input}
              placeholder="Название категории"
              placeholderTextColor="#71717A"
            />
            <PrimaryButton
              title={savingCategoryId === editingCategoryId ? 'Сохраняем категорию...' : 'Сохранить категорию'}
              onPress={() => saveCategory().catch(() => null)}
            />
            <SecondaryButton title="Отменить редактирование категории" onPress={cancelEditingCategory} />
          </View>
        ) : null}
      </ServiceCard>

      <ServiceCard>
        <SectionTitle>Куда добавить блюдо</SectionTitle>
        <View style={styles.categoryWrap}>
          {merchant?.menuCategories?.map((category: any) => {
            const active = category.id === selectedCategoryId;
            return (
              <View key={category.id} style={styles.categoryChipWrap}>
                <TouchableOpacity
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                  onPress={() => setSelectedCategoryId(category.id)}
                >
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.categoryMiniAction}
                  onPress={() => startEditingCategory(category)}
                >
                  <Text style={styles.categoryMiniActionText}>Изм.</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.categoryMiniAction}
                  onPress={() => reorderCategory(category.id, 'up').catch(() => null)}
                  disabled={reorderingCategoryId === category.id}
                >
                  <Text style={styles.categoryMiniActionText}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.categoryMiniAction}
                  onPress={() => reorderCategory(category.id, 'down').catch(() => null)}
                  disabled={reorderingCategoryId === category.id}
                >
                  <Text style={styles.categoryMiniActionText}>↓</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.categoryMiniAction, styles.categoryMiniDeleteAction]}
                  onPress={() =>
                    Alert.alert('Удалить категорию?', `Удалить "${category.name}"?`, [
                      { text: 'Отмена', style: 'cancel' },
                      {
                        text: deletingCategoryId === category.id ? 'Удаляем...' : 'Удалить',
                        style: 'destructive',
                        onPress: () => deleteCategory(category.id).catch(() => null),
                      },
                    ])
                  }
                  disabled={deletingCategoryId === category.id}
                >
                  <Text style={[styles.categoryMiniActionText, styles.categoryMiniDeleteActionText]}>
                    {deletingCategoryId === category.id ? '...' : 'Удал.'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
        {!merchant?.menuCategories?.length ? (
          <Text style={styles.emptyText}>Сначала создай хотя бы одну категорию меню.</Text>
        ) : null}
      </ServiceCard>

      <ServiceCard>
        <SectionTitle>{editingItemId ? 'Редактирование блюда' : 'Новое блюдо'}</SectionTitle>
        <TextInput
          value={itemName}
          onChangeText={setItemName}
          style={styles.input}
          placeholder="Название блюда"
          placeholderTextColor="#71717A"
        />
        <TextInput
          value={itemDescription}
          onChangeText={setItemDescription}
          style={[styles.input, styles.multilineInput]}
          placeholder="Короткое описание"
          placeholderTextColor="#71717A"
          multiline
        />
        <TextInput
          value={itemPrice}
          onChangeText={setItemPrice}
          style={styles.input}
          placeholder="Цена"
          placeholderTextColor="#71717A"
          keyboardType="numeric"
        />

        {itemImageUrl ? (
          <Image source={{ uri: itemImageUrl }} style={styles.itemPreviewImage} resizeMode="cover" />
        ) : null}

        <SecondaryButton
          title={uploadingImage ? 'Загружаем фото...' : 'Выбрать фото блюда'}
          onPress={() => pickAndUploadItemImage().catch(() => null)}
        />

        <PrimaryButton
          title={
            creatingItem
              ? editingItemId
                ? 'Сохраняем блюдо...'
                : 'Добавляем блюдо...'
              : selectedCategory
                ? editingItemId
                  ? `Сохранить в "${selectedCategory.name}"`
                  : `Добавить в "${selectedCategory.name}"`
                : editingItemId
                  ? 'Сохранить блюдо'
                  : 'Добавить блюдо'
          }
          onPress={() => createItem().catch(() => null)}
        />
        {editingItemId ? (
          <SecondaryButton title="Отменить редактирование" onPress={resetItemForm} />
        ) : null}
      </ServiceCard>

      <ServiceCard compact>
        <SectionTitle>Текущее меню</SectionTitle>
        {merchant?.menuCategories?.map((category: any) => (
          <View key={category.id} style={styles.categorySummaryBlock}>
            <InlineLabel
              label={category.name}
              value={`${category.items?.length || 0} блюд`}
              accentColor="#FB923C"
            />
            {category.items?.map((item: any) => (
              <View key={item.id} style={styles.itemSummaryCard}>
                <View style={styles.itemSummaryMain}>
                  <Text style={styles.itemSummaryName}>{item.name}</Text>
                  <Text style={styles.itemSummaryMeta} numberOfLines={1}>
                    {item.description || 'Без описания'}
                  </Text>
                </View>
                <Text style={styles.itemSummaryPrice}>{Math.round(Number(item.price))} тг</Text>
                <View style={styles.itemActionsRow}>
                  <TouchableOpacity
                    style={styles.itemActionButton}
                    onPress={() => reorderItem(item.id, 'up').catch(() => null)}
                    disabled={reorderingItemId === item.id}
                  >
                    <Text style={styles.itemActionButtonText}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.itemActionButton}
                    onPress={() => reorderItem(item.id, 'down').catch(() => null)}
                    disabled={reorderingItemId === item.id}
                  >
                    <Text style={styles.itemActionButtonText}>↓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.itemActionButton}
                    onPress={() => startEditingItem(item, category.id)}
                  >
                    <Text style={styles.itemActionButtonText}>Редактировать</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.itemActionButton, styles.itemDeleteButton]}
                    onPress={() =>
                      Alert.alert('Удалить блюдо?', `Удалить "${item.name}" из меню?`, [
                        { text: 'Отмена', style: 'cancel' },
                        {
                          text: deletingItemId === item.id ? 'Удаляем...' : 'Удалить',
                          style: 'destructive',
                          onPress: () => deleteItem(item.id).catch(() => null),
                        },
                      ])
                    }
                    disabled={deletingItemId === item.id}
                  >
                    <Text style={[styles.itemActionButtonText, styles.itemDeleteButtonText]}>
                      {deletingItemId === item.id ? 'Удаляем...' : 'Удалить'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ServiceCard>
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
    minHeight: 88,
    textAlignVertical: 'top',
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChipWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryChip: {
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  categoryChipActive: {
    backgroundColor: '#2D160B',
    borderColor: '#FB923C',
  },
  categoryChipText: {
    color: '#D4D4D8',
    fontSize: 14,
    fontWeight: '800',
  },
  categoryChipTextActive: {
    color: '#FED7AA',
  },
  categoryMiniAction: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3F3F46',
    backgroundColor: '#18181B',
  },
  categoryMiniActionText: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '800',
  },
  categoryMiniDeleteAction: {
    backgroundColor: '#2A1515',
    borderColor: '#7F1D1D',
  },
  categoryMiniDeleteActionText: {
    color: '#FCA5A5',
  },
  categoryEditorCard: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
  },
  categoryEditorTitle: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  emptyText: {
    color: '#71717A',
    fontSize: 14,
    marginTop: 10,
  },
  itemPreviewImage: {
    width: '100%',
    height: 180,
    borderRadius: 20,
    marginBottom: 12,
  },
  categorySummaryBlock: {
    marginBottom: 14,
  },
  itemSummaryCard: {
    backgroundColor: '#111318',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  itemSummaryMain: {
    marginBottom: 8,
  },
  itemSummaryName: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  itemSummaryMeta: {
    color: '#A1A1AA',
    fontSize: 12,
  },
  itemSummaryPrice: {
    color: '#FB923C',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  itemActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  itemActionButton: {
    flex: 1,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  itemActionButtonText: {
    color: '#F4F4F5',
    fontSize: 13,
    fontWeight: '800',
  },
  itemDeleteButton: {
    backgroundColor: '#2A1515',
    borderColor: '#7F1D1D',
  },
  itemDeleteButtonText: {
    color: '#FCA5A5',
  },
});
