import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
import { resolveApiAssetUrl } from '../../utils/assets';
import { showAlert } from '../../components/AppAlert';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'MenuEditor'>;

export const MenuEditorScreen: React.FC<Props> = ({ navigation }) => {
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
      showAlert('Нужна категория', 'Укажи название категории меню.');
      return;
    }

    try {
      setCreatingCategory(true);
      const response = await apiClient.post('/merchants/menu/categories', { name: categoryName.trim() });
      setCategoryName('');
      setSelectedCategoryId(response.data.id);
      await loadProfile();
    } catch (error: any) {
      showAlert('Ошибка', error?.response?.data?.message || 'Не удалось создать категорию');
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
      showAlert('Нужна категория', 'Укажи новое название категории.');
      return;
    }

    try {
      setSavingCategoryId(editingCategoryId);
      await apiClient.patch(`/merchants/menu/categories/${editingCategoryId}`, {
        name: editingCategoryName.trim(),
      });
      cancelEditingCategory();
      await loadProfile();
      showAlert('Готово', 'Категория обновлена');
    } catch (error: any) {
      showAlert('Ошибка', error?.response?.data?.message || 'Не удалось обновить категорию');
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
      showAlert('Готово', 'Категория удалена');
    } catch (error: any) {
      showAlert('Ошибка', error?.response?.data?.message || 'Не удалось удалить категорию');
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
      showAlert('Ошибка', error?.response?.data?.message || 'Не удалось изменить порядок категории');
    } finally {
      setReorderingCategoryId(null);
    }
  };

  const pickAndUploadItemImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        showAlert('Нужен доступ', 'Разреши доступ к галерее, чтобы загрузить фото блюда.');
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
      showAlert('Ошибка', error?.response?.data?.message || 'Не удалось загрузить фото блюда');
    } finally {
      setUploadingImage(false);
    }
  };

  const createItem = async () => {
    if (!selectedCategoryId) {
      showAlert('Сначала категория', 'Выбери категорию, в которую нужно добавить блюдо.');
      return;
    }

    if (!itemName.trim() || !itemPrice.trim()) {
      showAlert('Не хватает данных', 'Укажи название и цену блюда.');
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
      showAlert('Готово', editingItemId ? 'Блюдо обновлено' : 'Блюдо добавлено в меню');
    } catch (error: any) {
      showAlert('Ошибка', error?.response?.data?.message || 'Не удалось сохранить блюдо');
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
      showAlert('Готово', 'Блюдо удалено');
    } catch (error: any) {
      showAlert('Ошибка', error?.response?.data?.message || 'Не удалось удалить блюдо');
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
      showAlert('Ошибка', error?.response?.data?.message || 'Не удалось изменить порядок блюда');
    } finally {
      setReorderingItemId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.food} />
      </View>
    );
  }

  return (
    <ServiceScreen
      accentColor={colors.food}
      title="Редактор меню"
      backLabel="К кабинету"
      onBack={() => navigation.goBack()}
    >
      <ServiceCard>
        <SectionTitle>Новая категория</SectionTitle>
        <TextInput
          value={categoryName}
          onChangeText={setCategoryName}
          style={styles.input}
          placeholder="Например, Донеры"
          placeholderTextColor={colors.textTertiary}
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
              placeholderTextColor={colors.textTertiary}
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
                    showAlert('Удалить категорию?', `Удалить "${category.name}"?`, [
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
          placeholderTextColor={colors.textTertiary}
        />
        <TextInput
          value={itemDescription}
          onChangeText={setItemDescription}
          style={[styles.input, styles.multilineInput]}
          placeholder="Короткое описание"
          placeholderTextColor={colors.textTertiary}
          multiline
        />
        <TextInput
          value={itemPrice}
          onChangeText={setItemPrice}
          style={styles.input}
          placeholder="Цена"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
        />

        {itemImageUrl ? (
          <Image
            source={{ uri: resolveApiAssetUrl(itemImageUrl) }}
            style={styles.itemPreviewImage}
            resizeMode="cover"
          />
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
              accentColor={colors.food}
            />
            {category.items?.map((item: any) => (
              <View key={item.id} style={styles.itemSummaryCard}>
                <View style={styles.itemSummaryRow}>
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: resolveApiAssetUrl(item.imageUrl) }}
                      style={styles.itemSummaryImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.itemSummaryImageFallback}>
                      <Text style={styles.itemSummaryImageFallbackText}>
                        {item.name?.slice(0, 1)?.toUpperCase() || '•'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.itemSummaryMain}>
                  <Text style={styles.itemSummaryName}>{item.name}</Text>
                  <Text style={styles.itemSummaryMeta} numberOfLines={1}>
                    {item.description || 'Без описания'}
                  </Text>
                  </View>
                </View>
                <Text style={styles.itemSummaryPrice}>{Math.round(Number(item.price))} тг</Text>
                <View style={styles.itemActionsRow}>
                  <TouchableOpacity
                    style={[styles.itemActionButton, styles.itemMoveButton]}
                    onPress={() => reorderItem(item.id, 'up').catch(() => null)}
                    disabled={reorderingItemId === item.id}
                  >
                    <Text style={styles.itemActionButtonText}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.itemActionButton, styles.itemMoveButton]}
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
                      showAlert('Удалить блюдо?', `Удалить "${item.name}" из меню?`, [
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
    backgroundColor: colors.bg,
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
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  categoryChip: {
    flex: 1,
    minWidth: 120,
    backgroundColor: colors.surfaceSunken,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  categoryChipActive: {
    backgroundColor: colors.foodSurface,
    borderColor: colors.food,
  },
  categoryChipText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  categoryChipTextActive: {
    color: colors.foodTextSoft,
  },
  categoryMiniAction: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  categoryMiniActionText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  categoryMiniDeleteAction: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
  },
  categoryMiniDeleteActionText: {
    color: colors.dangerText,
  },
  categoryEditorCard: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  categoryEditorTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  emptyText: {
    color: colors.textTertiary,
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
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  itemSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  itemSummaryImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  itemSummaryImageFallback: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.foodSurface,
  },
  itemSummaryImageFallbackText: {
    color: colors.foodTextSoft,
    fontSize: 18,
    fontWeight: '900',
  },
  itemSummaryMain: {
    flex: 1,
  },
  itemSummaryName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  itemSummaryMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  itemSummaryPrice: {
    color: colors.food,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  itemActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  itemActionButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  itemActionButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  itemMoveButton: {
    flex: 0,
    width: 48,
  },
  itemDeleteButton: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
  },
  itemDeleteButtonText: {
    color: colors.dangerText,
  },
});
