import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  const totalPrice = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0),
    [cart],
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!selectedCategoryId && merchant?.menuCategories?.length) {
      setSelectedCategoryId(merchant.menuCategories[0].id);
    }
  }, [merchant?.menuCategories, selectedCategoryId]);

  const visibleCategories = merchant?.menuCategories ?? [];
  const selectedCategory =
    visibleCategories.find((category: any) => category.id === selectedCategoryId) || visibleCategories[0];

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
      subtitle="Выбирай по категориям, смотри фото блюд и собирай заказ без лишнего шума."
      backLabel="К заведениям"
      onBack={() => navigation.goBack()}
    >
      {merchant?.menuCategories?.length ? (
        <>
          <ImageBackground
            source={merchant?.coverImageUrl ? { uri: merchant.coverImageUrl } : undefined}
            style={[styles.coverHero, { backgroundColor: merchant?.tone || '#7C2D12' }]}
            imageStyle={styles.coverHeroImage}
          >
            <View style={styles.coverOverlay} />
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{merchant?.etaMinutes || 35} мин</Text>
              </View>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>от {Math.round(Number(merchant?.minOrder || 0))} тг</Text>
              </View>
            </View>
            <View style={styles.coverContent}>
              <Text style={styles.coverTitle}>{merchant?.name || restaurantName}</Text>
              <Text style={styles.coverMeta}>
                {merchant?.cuisine || 'Кухня'} • {merchant?.etaMinutes || 35} мин • от {Math.round(Number(merchant?.minOrder || 0))} тг
              </Text>
            </View>
          </ImageBackground>

          <ServiceCard compact>
            <View style={styles.quickFactsRow}>
              <View style={styles.quickFact}>
                <Text style={styles.quickFactValue}>{merchant?.menuCategories?.length || 0}</Text>
                <Text style={styles.quickFactLabel}>категорий</Text>
              </View>
              <View style={styles.quickFact}>
                <Text style={styles.quickFactValue}>
                  {merchant?.menuCategories?.reduce((sum: number, category: any) => sum + (category.items?.length || 0), 0) || 0}
                </Text>
                <Text style={styles.quickFactLabel}>блюд</Text>
              </View>
              <View style={styles.quickFact}>
                <Text style={styles.quickFactValue}>{Number(merchant?.rating || 5).toFixed(1)}</Text>
                <Text style={styles.quickFactLabel}>рейтинг</Text>
              </View>
            </View>
          </ServiceCard>

          <ServiceCard compact>
            <SectionTitle>Категории</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail}>
              {merchant.menuCategories.map((category: any) => {
                const isActive = category.id === selectedCategory?.id;
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                    onPress={() => setSelectedCategoryId(category.id)}
                  >
                    <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                      {category.name}
                    </Text>
                    <Text style={[styles.categoryChipMeta, isActive && styles.categoryChipMetaActive]}>
                      {category.items?.length || 0} блюд
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </ServiceCard>

          {selectedCategory ? (
            <ServiceCard key={selectedCategory.id}>
              <SectionTitle>{selectedCategory.name}</SectionTitle>
              {selectedCategory.items.map((item: any) => (
                <View key={item.id} style={styles.itemRow}>
                  {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.itemImage} resizeMode="cover" /> : (
                    <View style={styles.itemImageFallback}>
                      <Text style={styles.itemImageFallbackText}>{item.name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )}
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
          ) : null}
        </>
      ) : (
        <ServiceCard compact>
          <Text style={styles.emptyText}>У этого заведения пока нет меню. Добавь категории и блюда из merchant-кабинета.</Text>
        </ServiceCard>
      )}

      <PrimaryButton
        title={totalItems > 0 ? `Корзина • ${totalItems} • ${Math.round(totalPrice)} тг` : 'Корзина пуста'}
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
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  categoryRail: {
    gap: 10,
  },
  coverHero: {
    minHeight: 190,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: 14,
  },
  coverHeroImage: {
    borderRadius: 28,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 9, 11, 0.32)',
  },
  heroBadgeRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroBadge: {
    backgroundColor: 'rgba(9, 9, 11, 0.72)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heroBadgeText: {
    color: '#FFF7ED',
    fontSize: 11,
    fontWeight: '800',
  },
  coverContent: {
    padding: 20,
  },
  coverTitle: {
    color: '#FFF7ED',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 6,
  },
  coverMeta: {
    color: '#FED7AA',
    fontSize: 13,
    fontWeight: '700',
  },
  categoryChip: {
    minWidth: 120,
    backgroundColor: '#09090B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  categoryChipActive: {
    backgroundColor: '#3F1F0F',
    borderColor: '#FB923C',
  },
  categoryChipText: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  categoryChipTextActive: {
    color: '#FED7AA',
  },
  categoryChipMeta: {
    color: '#A1A1AA',
    fontSize: 12,
  },
  categoryChipMetaActive: {
    color: '#FDBA74',
  },
  quickFactsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickFact: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingVertical: 14,
    alignItems: 'center',
  },
  quickFactValue: {
    color: '#F4F4F5',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  quickFactLabel: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  itemImage: {
    width: 78,
    height: 78,
    borderRadius: 18,
  },
  itemImageFallback: {
    width: 78,
    height: 78,
    borderRadius: 18,
    backgroundColor: '#3F1F0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImageFallbackText: {
    color: '#FED7AA',
    fontSize: 28,
    fontWeight: '900',
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
