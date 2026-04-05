import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { DarkAlertModal } from '../../components/DarkAlertModal';
import { PrimaryButton, ServiceScreen } from '../../components/ServiceScreen';
import { openWhatsAppOrder } from '../../utils/foodWhatsapp';

type Props = NativeStackScreenProps<RootStackParamList, 'Restaurant'>;

type CartEntry = { menuItemId: string; name: string; price: string; qty: number };
type CategoryOffset = { id: string; y: number };

export const RestaurantScreen: React.FC<Props> = ({ navigation, route }) => {
  const { restaurantId, restaurantName } = route.params;
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<any>(null);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryOffsets, setCategoryOffsets] = useState<Record<string, number>>({});
  const [modal, setModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    primaryLabel?: string;
    secondaryLabel?: string;
    primaryVariant?: 'default' | 'danger';
    onPrimary?: () => void;
    onSecondary?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
  });
  const scrollRef = useRef<ScrollView>(null);
  const isProgrammaticScrollRef = useRef(false);

  const closeModal = () =>
    setModal({
      visible: false,
      title: '',
      message: '',
    });

  const openModal = (next: Omit<typeof modal, 'visible'>) =>
    setModal({
      visible: true,
      ...next,
    });

  const loadMerchant = useCallback(() => {
    setLoading(true);
    apiClient
      .get(`/merchants/${restaurantId}/menu`)
      .then((response) => setMerchant(response.data))
      .catch(() =>
        openModal({
          title: 'Ошибка',
          message: 'Не удалось загрузить меню',
          primaryLabel: 'Понятно',
        }),
      )
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

  const categories = merchant?.menuCategories ?? [];

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);
  const totalPrice = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0),
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

  const getItemQty = (itemId: string) => cart.find((item) => item.menuItemId === itemId)?.qty ?? 0;

  const handleCategoryPress = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    const targetY = categoryOffsets[categoryId];
    if (typeof targetY !== 'number') {
      return;
    }

    isProgrammaticScrollRef.current = true;
    scrollRef.current?.scrollTo({ y: Math.max(targetY - 210, 0), animated: true });
    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 450);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isProgrammaticScrollRef.current || categories.length === 0) {
      return;
    }

    const y = event.nativeEvent.contentOffset.y + 220;
    const sorted: CategoryOffset[] = categories
      .map((category: any) => ({
        id: category.id,
        y: categoryOffsets[category.id] ?? Number.MAX_SAFE_INTEGER,
      }))
      .sort((a: CategoryOffset, b: CategoryOffset) => a.y - b.y);

    const current = sorted.reduce((found: string | null, category: CategoryOffset) => {
      if (category.y <= y) {
        return category.id;
      }
      return found;
    }, sorted[0]?.id ?? null);

    if (current && current !== selectedCategoryId) {
      setSelectedCategoryId(current);
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
      title={restaurantName}
      subtitle=""
      backLabel="К заведениям"
      onBack={() => navigation.goBack()}
    >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <ImageBackground
          source={merchant?.coverImageUrl ? { uri: merchant.coverImageUrl } : undefined}
          style={[styles.hero, { backgroundColor: merchant?.tone || '#7C2D12' }]}
          imageStyle={styles.heroImage}
        >
          <View style={styles.heroOverlay} />
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaChip}>
              <Text style={styles.heroMetaChipText}>{merchant?.etaMinutes || 35} мин</Text>
            </View>
            <View style={styles.heroMetaChip}>
              <Text style={styles.heroMetaChipText}>★ {Number(merchant?.rating || 5).toFixed(1)}</Text>
            </View>
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{merchant?.name || restaurantName}</Text>
            <Text style={styles.heroSubtitle} numberOfLines={1}>
              {merchant?.cuisine || 'Кухня'} • от {Math.round(Number(merchant?.minOrder || 0))} тг
            </Text>
          </View>
        </ImageBackground>

        <View style={styles.quickFactsRow}>
          <View style={styles.quickFactCard}>
            <Text style={styles.quickFactValue}>{categories.length}</Text>
            <Text style={styles.quickFactLabel}>категорий</Text>
          </View>
          <View style={styles.quickFactCard}>
            <Text style={styles.quickFactValue}>
              {categories.reduce((sum: number, category: any) => sum + (category.items?.length || 0), 0)}
            </Text>
            <Text style={styles.quickFactLabel}>блюд</Text>
          </View>
          <View style={styles.quickFactCard}>
            <Text style={styles.quickFactValue}>{Math.round(Number(merchant?.minOrder || 0))}</Text>
            <Text style={styles.quickFactLabel}>мин. чек</Text>
          </View>
        </View>

        <View style={styles.contactRow}>
          <View style={styles.contactInfo}>
            <Text style={styles.contactLabel}>WhatsApp ресторана</Text>
            <Text style={styles.contactValue}>
              {merchant?.whatsAppPhone || 'Номер пока не указан'}
            </Text>
          </View>
          {merchant?.whatsAppPhone ? (
            <TouchableOpacity
              style={styles.contactButton}
              onPress={async () => {
                const opened = await openWhatsAppOrder({
                  restaurantName: merchant?.name || restaurantName,
                  phone: merchant.whatsAppPhone,
                  items: [],
                  address: 'Уточню адрес позже',
                  total: 0,
                  comment: 'Здравствуйте! Хочу уточнить меню и оформить заказ.',
                });

                if (!opened) {
                  openModal({
                    title: 'WhatsApp недоступен',
                    message: `Напишите ресторану вручную: ${merchant.whatsAppPhone}`,
                    primaryLabel: 'Позвонить',
                    secondaryLabel: 'Позже',
                    onPrimary: () => {
                      closeModal();
                      Linking.openURL(`tel:${merchant.whatsAppPhone}`).catch(() => null);
                    },
                    onSecondary: closeModal,
                  });
                }
              }}
            >
              <Text style={styles.contactButtonText}>WhatsApp</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {categories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRail}
            style={styles.categoryRailWrap}
          >
            {categories.map((category: any) => {
              const active = selectedCategoryId === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.categoryTab, active && styles.categoryTabActive]}
                  onPress={() => handleCategoryPress(category.id)}
                >
                  <Text style={[styles.categoryTabText, active && styles.categoryTabTextActive]}>
                    {category.name}
                  </Text>
                  <Text style={[styles.categoryTabMeta, active && styles.categoryTabMetaActive]}>
                    {category.items?.length || 0}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {categories.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>Меню пока пустое</Text>
            <Text style={styles.emptyText}>
              У этого заведения еще нет опубликованных категорий и блюд.
            </Text>
          </View>
        ) : null}

        {categories.map((category: any) => (
          <View
            key={category.id}
            style={styles.section}
            onLayout={(event) => {
              const { y } = event.nativeEvent.layout;
              setCategoryOffsets((current) => ({
                ...current,
                [category.id]: y,
              }));
            }}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{category.name}</Text>
              <Text style={styles.sectionMeta}>{category.items?.length || 0} блюд</Text>
            </View>

            {category.items.map((item: any) => {
              const qty = getItemQty(item.id);
              return (
                <View key={item.id} style={styles.menuRow}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.menuImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.menuImageFallback}>
                      <Text style={styles.menuImageFallbackText}>
                        {item.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View style={styles.menuBody}>
                    <Text style={styles.menuName}>{item.name}</Text>
                    <Text style={styles.menuDescription} numberOfLines={1}>
                      {item.description || 'Без описания'}
                    </Text>
                    <View style={styles.menuBottomRow}>
                      <Text style={styles.menuPrice}>{Math.round(Number(item.price))} тг</Text>
                      <TouchableOpacity style={styles.addButton} onPress={() => addToCart(item)}>
                        <Text style={styles.addButtonText}>{qty > 0 ? `+ ${qty}` : '+'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <PrimaryButton
        title={totalItems > 0 ? `Корзина • ${totalItems} • ${Math.round(totalPrice)} тг` : 'Корзина пуста'}
        onPress={() =>
          totalItems > 0
            ? navigation.navigate('Cart', {
                restaurantId,
                restaurantName,
                merchantWhatsAppPhone: merchant?.whatsAppPhone || null,
                items: cart,
              })
            : openModal({
                title: 'Корзина пуста',
                message: 'Сначала добавь хотя бы одно блюдо.',
                primaryLabel: 'Понятно',
              })
        }
      />

      <DarkAlertModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        primaryLabel={modal.primaryLabel}
        secondaryLabel={modal.secondaryLabel}
        primaryVariant={modal.primaryVariant}
        onPrimary={() => {
          const action = modal.onPrimary;
          if (action) {
            action();
            return;
          }
          closeModal();
        }}
        onSecondary={() => {
          const action = modal.onSecondary;
          if (action) {
            action();
            return;
          }
          closeModal();
        }}
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
  hero: {
    minHeight: 214,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  heroImage: {
    borderRadius: 28,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9,9,11,0.28)',
  },
  heroMetaRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroMetaChip: {
    backgroundColor: 'rgba(9,9,11,0.72)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heroMetaChipText: {
    color: '#FFF7ED',
    fontSize: 11,
    fontWeight: '800',
  },
  heroContent: {
    padding: 20,
  },
  heroTitle: {
    color: '#FFF7ED',
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#FED7AA',
    fontSize: 13,
    fontWeight: '700',
  },
  quickFactsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  quickFactCard: {
    flex: 1,
    minHeight: 74,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
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
  categoryRailWrap: {
    marginBottom: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#151518',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  contactValue: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
  },
  contactButton: {
    backgroundColor: '#143124',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  contactButtonText: {
    color: '#86EFAC',
    fontSize: 13,
    fontWeight: '900',
  },
  categoryRail: {
    gap: 10,
    paddingRight: 8,
  },
  categoryTab: {
    minWidth: 104,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  categoryTabActive: {
    backgroundColor: '#2D160B',
    borderColor: '#FB923C',
  },
  categoryTabText: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  categoryTabTextActive: {
    color: '#FED7AA',
  },
  categoryTabMeta: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryTabMetaActive: {
    color: '#FDBA74',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#F4F4F5',
    fontSize: 22,
    fontWeight: '900',
  },
  sectionMeta: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
  },
  menuRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  menuImage: {
    width: 82,
    height: 82,
    borderRadius: 20,
  },
  menuImageFallback: {
    width: 82,
    height: 82,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D160B',
  },
  menuImageFallbackText: {
    color: '#FED7AA',
    fontSize: 28,
    fontWeight: '900',
  },
  menuBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  menuName: {
    color: '#F4F4F5',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  menuDescription: {
    color: '#A1A1AA',
    fontSize: 13,
    marginBottom: 8,
  },
  menuBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  menuPrice: {
    color: '#FB923C',
    fontSize: 15,
    fontWeight: '900',
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#3F3F46',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '900',
  },
  emptyBlock: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#F4F4F5',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyText: {
    color: '#A1A1AA',
    fontSize: 14,
    lineHeight: 20,
  },
});
