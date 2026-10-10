import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { ServiceScreen } from '../../components/ServiceScreen';
import { resolveApiAssetUrl } from '../../utils/assets';
import { FoodCoverArt } from '../../components/Food/FoodCoverArt';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'FoodHome'>;

type CatalogCategoryId =
  | 'all'
  | 'burgers'
  | 'pizza'
  | 'sushi'
  | 'doner'
  | 'grill'
  | 'coffee'
  | 'bakery';

type QuickFilterId = 'fast' | 'rating' | 'budget';

type RestaurantSummary = {
  id: string;
  name: string;
  whatsAppPhone?: string | null;
  cuisine?: string | null;
  description?: string | null;
  etaMinutes?: number | null;
  minOrder?: number | null;
  rating?: number | null;
  coverImageUrl?: string | null;
  tone?: string | null;
};

const FOOD_CATEGORIES: Array<{
  id: CatalogCategoryId;
  label: string;
  emoji: string;
  keywords: string[];
}> = [
  { id: 'all', label: 'Все', emoji: '🍽️', keywords: [] },
  { id: 'burgers', label: 'Бургеры', emoji: '🍔', keywords: ['бургер', 'burger'] },
  { id: 'pizza', label: 'Пицца', emoji: '🍕', keywords: ['пицц', 'pizza'] },
  { id: 'sushi', label: 'Суши', emoji: '🍣', keywords: ['суш', 'ролл', 'sushi'] },
  { id: 'doner', label: 'Донер', emoji: '🌯', keywords: ['донер', 'шаур', 'шаверм', 'doner'] },
  { id: 'grill', label: 'Шашлык', emoji: '🍢', keywords: ['шашл', 'грил', 'grill', 'bbq'] },
  { id: 'coffee', label: 'Кофе', emoji: '☕', keywords: ['кофе', 'coffee', 'cafe', 'кафе'] },
  { id: 'bakery', label: 'Выпечка', emoji: '🥐', keywords: ['выпеч', 'булоч', 'пекар', 'dessert'] },
];

const QUICK_FILTERS: Array<{ id: QuickFilterId; label: string }> = [
  { id: 'fast', label: 'До 30 мин' },
  { id: 'rating', label: 'Рейтинг 4.5+' },
  { id: 'budget', label: 'от 1500 тг' },
];

function getCategoryMatches(restaurant: RestaurantSummary) {
  const haystack = [restaurant.name, restaurant.cuisine, restaurant.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return FOOD_CATEGORIES.filter((category) => {
    if (category.id === 'all') {
      return false;
    }

    return category.keywords.some((keyword) => haystack.includes(keyword));
  }).map((category) => category.id);
}

function getPromoTag(restaurant: RestaurantSummary) {
  const text = [restaurant.cuisine, restaurant.description].filter(Boolean).join(' ').toLowerCase();

  if (/(бесплатн|free delivery|доставка 0)/i.test(text)) {
    return 'Бесплатная доставка';
  }

  if (Number(restaurant.etaMinutes ?? 40) <= 25) {
    return 'Быстро привезут';
  }

  if (Number(restaurant.rating ?? 0) >= 4.8) {
    return 'Высокий рейтинг';
  }

  return restaurant.cuisine || 'Популярно рядом';
}

export const FoodHomeScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [activeCategory, setActiveCategory] = useState<CatalogCategoryId>('all');
  const [activeFilter, setActiveFilter] = useState<QuickFilterId | null>(null);

  const loadRestaurants = useCallback(() => {
    setLoading(true);
    apiClient
      .get('/merchants/public')
      .then((response) => setRestaurants(response.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  useFocusEffect(
    useCallback(() => {
      loadRestaurants();
    }, [loadRestaurants]),
  );

  const enrichedRestaurants = useMemo(
    () =>
      restaurants.map((restaurant) => ({
        ...restaurant,
        categories: getCategoryMatches(restaurant),
      })),
    [restaurants],
  );

  const featuredRestaurant = enrichedRestaurants[0] ?? null;

  const filteredRestaurants = useMemo(() => {
    return enrichedRestaurants.filter((restaurant) => {
      if (activeCategory !== 'all' && !restaurant.categories.includes(activeCategory)) {
        return false;
      }

      if (activeFilter === 'fast' && Number(restaurant.etaMinutes ?? 40) > 30) {
        return false;
      }

      if (activeFilter === 'rating' && Number(restaurant.rating ?? 0) < 4.5) {
        return false;
      }

      if (activeFilter === 'budget' && Number(restaurant.minOrder ?? 99999) > 1500) {
        return false;
      }

      return true;
    });
  }, [activeCategory, activeFilter, enrichedRestaurants]);

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
      eyebrow="Еда"
      title="Рестораны"
      subtitle=""
      backLabel="К карте"
      onBack={() => navigation.goBack()}
    >
      <TouchableOpacity
        style={styles.historyButton}
        onPress={() => navigation.navigate('FoodOrderHistory')}
      >
        <Text style={styles.historyButtonText}>Мои заказы</Text>
        <Text style={styles.historyButtonArrow}>›</Text>
      </TouchableOpacity>
      {featuredRestaurant ? (
        <TouchableOpacity
          style={styles.featuredCard}
          activeOpacity={0.92}
          onPress={() =>
            navigation.navigate('Restaurant', {
              restaurantId: featuredRestaurant.id,
              restaurantName: featuredRestaurant.name,
            })
          }
        >
          <FoodCoverArt
            imageUrl={resolveApiAssetUrl(featuredRestaurant.coverImageUrl)}
            seed={featuredRestaurant.id}
            hints={[featuredRestaurant.cuisine, featuredRestaurant.description, featuredRestaurant.name]}
            style={styles.featuredImage}
            imageStyle={styles.featuredImageInner}
          >
            <View style={styles.featuredOverlay} />
            <View style={styles.featuredContent}>
              <Text style={styles.featuredEyebrow}>Подборка дня</Text>
              <Text style={styles.featuredTitle}>{featuredRestaurant.name}</Text>
              <Text style={styles.featuredSubtitle} numberOfLines={2}>
                {featuredRestaurant.description || featuredRestaurant.cuisine || 'Вкусный вечер рядом'}
              </Text>
              <View style={styles.featuredMetaRow}>
                <Text style={styles.featuredChip}>{featuredRestaurant.etaMinutes || 35} мин</Text>
                <Text style={styles.featuredChip}>
                  ★ {Number(featuredRestaurant.rating || 5).toFixed(1)}
                </Text>
              </View>
            </View>
          </FoodCoverArt>
        </TouchableOpacity>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRail}
      >
        {FOOD_CATEGORIES.map((category) => {
          const active = activeCategory === category.id;
          return (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryCard}
              onPress={() => setActiveCategory(category.id)}
            >
              <View style={[styles.categoryIconWrap, active && styles.categoryIconWrapActive]}>
                <Text style={styles.categoryEmoji}>{category.emoji}</Text>
              </View>
              <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                {category.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRail}
      >
        {QUICK_FILTERS.map((filter) => {
          const active = activeFilter === filter.id;
          return (
            <TouchableOpacity
              key={filter.id}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setActiveFilter((current) => (current === filter.id ? null : filter.id))}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {filteredRestaurants.length === 0 ? (
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyTitle}>Ничего не нашлось</Text>
          <Text style={styles.emptyText}>
            Сними фильтр или вернись в категорию `Все`, чтобы увидеть больше заведений.
          </Text>
        </View>
      ) : null}

      {filteredRestaurants.map((restaurant) => (
        <TouchableOpacity
          key={restaurant.id}
          style={styles.restaurantCard}
          activeOpacity={0.92}
          onPress={() =>
            navigation.navigate('Restaurant', {
              restaurantId: restaurant.id,
              restaurantName: restaurant.name,
            })
          }
        >
          <FoodCoverArt
            imageUrl={resolveApiAssetUrl(restaurant.coverImageUrl)}
            seed={restaurant.id}
            hints={[restaurant.cuisine, restaurant.description, restaurant.name]}
            style={styles.restaurantImage}
            imageStyle={styles.restaurantImageInner}
          >
            <View style={styles.restaurantImageOverlay} />
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingBadgeText}>★ {Number(restaurant.rating || 5).toFixed(1)}</Text>
            </View>
          </FoodCoverArt>

          <View style={styles.restaurantBody}>
            <View style={styles.restaurantTitleRow}>
              <Text style={styles.restaurantName}>{restaurant.name}</Text>
              <Text style={styles.restaurantEta}>{restaurant.etaMinutes || 35} мин</Text>
            </View>
            <Text style={styles.restaurantSecondary} numberOfLines={1}>
              {restaurant.cuisine || restaurant.description || 'Кухня уточняется'}
            </Text>
            <View style={styles.restaurantMetaRow}>
              <View style={styles.restaurantWhatsappPill}>
                <Text style={styles.restaurantWhatsappText}>Заказ внутри Zhetysu Go</Text>
              </View>
              <View style={styles.restaurantPromoPill}>
                <Text style={styles.restaurantPromoText}>{getPromoTag(restaurant)}</Text>
              </View>
              <View style={styles.restaurantMutedPill}>
                <Text style={styles.restaurantMutedText}>
                  от {Math.round(Number(restaurant.minOrder || 0))} тг
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ServiceScreen>
  );
};

const styles = StyleSheet.create({
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 16,
  },
  historyButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  historyButtonArrow: {
    color: colors.food,
    fontSize: 25,
    lineHeight: 25,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  featuredCard: {
    marginBottom: 18,
  },
  featuredImage: {
    minHeight: 180,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  featuredImageInner: {
    borderRadius: 28,
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9,9,11,0.32)',
  },
  featuredContent: {
    padding: 22,
  },
  featuredEyebrow: {
    color: colors.foodTextSoft,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  featuredTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
  },
  featuredSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  featuredMetaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  featuredChip: {
    color: colors.foodTextSoft,
    backgroundColor: 'rgba(9,9,11,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '800',
  },
  categoryRail: {
    gap: 12,
    paddingBottom: 6,
    marginBottom: 14,
  },
  categoryCard: {
    width: 82,
    alignItems: 'center',
  },
  categoryIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryIconWrapActive: {
    backgroundColor: colors.foodSurface,
    borderColor: colors.food,
  },
  categoryEmoji: {
    fontSize: 28,
  },
  categoryLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  categoryLabelActive: {
    color: colors.text,
  },
  filterRail: {
    gap: 10,
    paddingBottom: 6,
    marginBottom: 14,
  },
  filterChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: colors.foodSurface,
    borderColor: colors.food,
  },
  filterChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: colors.foodTextSoft,
  },
  restaurantCard: {
    marginBottom: 18,
  },
  restaurantImage: {
    minHeight: 196,
    borderRadius: 26,
    overflow: 'hidden',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  restaurantImageInner: {
    borderRadius: 26,
  },
  restaurantImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9,9,11,0.18)',
  },
  ratingBadge: {
    alignSelf: 'flex-end',
    marginTop: 14,
    marginRight: 14,
    backgroundColor: 'rgba(9,9,11,0.74)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  ratingBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  restaurantBody: {
    paddingHorizontal: 2,
  },
  restaurantTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 6,
  },
  restaurantName: {
    flex: 1,
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  restaurantEta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 5,
  },
  restaurantSecondary: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 10,
  },
  restaurantMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  restaurantPromoPill: {
    backgroundColor: colors.successSurface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  restaurantWhatsappPill: {
    backgroundColor: colors.successSurface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  restaurantWhatsappText: {
    color: colors.successText,
    fontSize: 12,
    fontWeight: '800',
  },
  restaurantPromoText: {
    color: colors.successText,
    fontSize: 12,
    fontWeight: '800',
  },
  restaurantMutedPill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  restaurantMutedText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBlock: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
