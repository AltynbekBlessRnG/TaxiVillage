import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import {
  InlineLabel,
  PrimaryButton,
  SectionTitle,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'MenuEditor'>;

export const MenuEditorScreen: React.FC<Props> = () => {
  const [merchant, setMerchant] = useState<any>(null);
  const [categoryName, setCategoryName] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice, setItemPrice] = useState('');

  const loadProfile = () =>
    apiClient.get('/merchants/profile/me').then((response) => setMerchant(response.data));

  useEffect(() => {
    loadProfile().catch(() => null);
  }, []);

  const createCategory = async () => {
    if (!categoryName) {
      return;
    }
    await apiClient.post('/merchants/menu/categories', { name: categoryName });
    setCategoryName('');
    await loadProfile();
  };

  const createItem = async () => {
    const firstCategory = merchant?.menuCategories?.[0];
    if (!firstCategory) {
      Alert.alert('Сначала категория', 'Сначала создай хотя бы одну категорию меню.');
      return;
    }
    if (!itemName || !itemPrice) {
      Alert.alert('Не хватает данных', 'Укажи название и цену блюда.');
      return;
    }

    await apiClient.post('/merchants/menu/items', {
      categoryId: firstCategory.id,
      name: itemName,
      description: itemDescription || undefined,
      price: Number(itemPrice),
    });
    setItemName('');
    setItemDescription('');
    setItemPrice('');
    await loadProfile();
  };

  return (
    <ServiceScreen
      accentColor="#FB923C"
      eyebrow="Меню"
      title="Редактор меню"
      subtitle="Merchant уже может создавать категории и блюда, а passenger-каталог сразу их подхватывает."
    >
      <ServiceCard>
        <SectionTitle>Новая категория</SectionTitle>
        <TextInput
          value={categoryName}
          onChangeText={setCategoryName}
          style={styles.input}
          placeholder="Например, Популярное"
          placeholderTextColor="#71717A"
        />
        <PrimaryButton title="Создать категорию" onPress={() => createCategory().catch(() => null)} />
      </ServiceCard>

      <ServiceCard>
        <SectionTitle>Новое блюдо</SectionTitle>
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
          style={styles.input}
          placeholder="Описание"
          placeholderTextColor="#71717A"
        />
        <TextInput
          value={itemPrice}
          onChangeText={setItemPrice}
          style={styles.input}
          placeholder="Цена"
          placeholderTextColor="#71717A"
          keyboardType="numeric"
        />
        <PrimaryButton title="Добавить блюдо" onPress={() => createItem().catch(() => null)} />
      </ServiceCard>

      <ServiceCard compact>
        <SectionTitle>Текущее меню</SectionTitle>
        {merchant?.menuCategories?.map((category: any) => (
          <InlineLabel
            key={category.id}
            label={category.name}
            value={`${category.items?.length || 0} блюд`}
            accentColor="#FB923C"
          />
        ))}
      </ServiceCard>
    </ServiceScreen>
  );
};

const styles = StyleSheet.create({
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
});
