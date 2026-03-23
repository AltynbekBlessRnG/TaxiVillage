import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { PrimaryButton, SectionTitle, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Restaurant'>;

export const RestaurantScreen: React.FC<Props> = ({ navigation, route }) => {
  const { restaurantId, restaurantName } = route.params;
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<any>(null);
  const [cart, setCart] = useState<Array<{ menuItemId: string; name: string; price: string; qty: number }>>([]);

  const loadMerchant = useCallback(() => {
    apiClient
      .get(`/merchants/${restaurantId}/menu`)
      .then((response) => setMerchant(response.data))
      .catch(() => Alert.alert('Ошибка', 'Не удалось загрузить меню'))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  useEffect(() => {
    loadMerchant();
  }, [loadMerchant]);

  useFocusEffect(
    useCallback(() => {
      loadMerchant();
    }, [loadMerchant]),
  );

  const totalItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart],
  );

  const addToCart = (item: any) => {
    setCart((current) => {
      const existing = current.find((entry) => entry.menuItemId === item.id);
      if (existing) {
        return current.map((entry) =>
          entry.menuItemId === item.id ? { ...entry, qty: entry.qty + 1 } : entry,
        );
      }
      return [
        ...current,
        {
          menuItemId: item.id,
          name: item.name,
          price: `${Math.round(Number(item.price))}`,
          qty: 1,
        },
      ];
    });
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
      title={restaurantName}
      subtitle="Меню уже читает реальные категории и блюда merchant-а из backend."
      backLabel="К заведениям"
      onBack={() => navigation.goBack()}
    >
      {merchant?.menuCategories?.length ? (
        merchant.menuCategories.map((category: any) => (
          <ServiceCard key={category.id}>
            <SectionTitle>{category.name}</SectionTitle>
            {category.items.map((item: any) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemMeta}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemDescription}>{item.description || 'Без описания'}</Text>
                  <Text style={styles.itemPrice}>{Math.round(Number(item.price))} тг</Text>
                </View>
                <TouchableOpacity style={styles.addButton} onPress={() => addToCart(item)}>
                  <Text style={styles.addButtonText}>Добавить</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ServiceCard>
        ))
      ) : (
        <ServiceCard compact>
          <Text style={styles.emptyText}>У этого заведения пока нет меню. Добавь категории и блюда из merchant-кабинета.</Text>
        </ServiceCard>
      )}

      <PrimaryButton
        title={totalItems > 0 ? `Открыть корзину (${totalItems})` : 'Корзина пуста'}
        onPress={() =>
          totalItems > 0
            ? navigation.navigate('Cart', {
                restaurantId,
                restaurantName,
                items: cart,
              })
            : Alert.alert('Корзина пуста', 'Сначала добавь хотя бы одно блюдо.')
        }
      />
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
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  itemMeta: {
    flex: 1,
  },
  itemName: {
    color: '#F4F4F5',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  itemDescription: {
    color: '#A1A1AA',
    fontSize: 13,
    marginBottom: 6,
  },
  itemPrice: {
    color: '#FB923C',
    fontSize: 14,
    fontWeight: '800',
  },
  addButton: {
    backgroundColor: '#292524',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addButtonText: {
    color: '#F4F4F5',
    fontWeight: '800',
  },
  emptyText: {
    color: '#A1A1AA',
    fontSize: 15,
    lineHeight: 22,
  },
});
