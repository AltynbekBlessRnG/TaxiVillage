import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import {
  ChipRow,
  InlineLabel,
  SectionTitle,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'FoodHome'>;

export const FoodHomeScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const featuredTags = useMemo(() => ['Быстрая доставка', 'Плов', 'Суши', 'Бургеры', 'Семейный ужин'], []);
  const cuisineHighlights = useMemo(
    () =>
      Array.from(
        new Set(
          restaurants
            .map((restaurant) => restaurant.cuisine)
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
        ),
      ).slice(0, 6),
    [restaurants],
  );

  const loadRestaurants = useCallback(() => {
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
      eyebrow="Еда"
      title="Заведения рядом"
      subtitle="Открывай заведение, смотри меню и собирай заказ без лишних экранов."
      backLabel="К такси"
      onBack={() => navigation.goBack()}
    >
      <View style={styles.heroBlock}>
        <Text style={styles.heroTitle}>Сегодня хочется чего-то вкусного</Text>
        <Text style={styles.heroText}>
          Выбирай по настроению: быстрый перекус, домашний ужин или длинный вечер с доставкой.
        </Text>
      </View>

      <ServiceCard compact>
        <SectionTitle>Подборка на сегодня</SectionTitle>
        <ChipRow items={featuredTags} />
      </ServiceCard>

      {cuisineHighlights.length > 0 ? (
        <ServiceCard compact>
          <SectionTitle>Кухни рядом</SectionTitle>
          <View style={styles.cuisineWrap}>
            {cuisineHighlights.map((item) => (
              <View key={item} style={styles.cuisinePill}>
                <Text style={styles.cuisinePillText}>{item}</Text>
              </View>
            ))}
          </View>
        </ServiceCard>
      ) : null}

      {restaurants.length === 0 ? (
        <ServiceCard compact>
          <Text style={styles.emptyText}>Пока нет зарегистрированных заведений. Зарегистрируй `MERCHANT`, добавь меню и каталог сразу появится здесь.</Text>
        </ServiceCard>
      ) : null}

      {restaurants.map((restaurant) => (
        <TouchableOpacity
          key={restaurant.id}
          style={styles.restaurantCard}
          onPress={() =>
            navigation.navigate('Restaurant', {
              restaurantId: restaurant.id,
              restaurantName: restaurant.name,
            })
          }
        >
          <ImageBackground
            source={restaurant.coverImageUrl ? { uri: restaurant.coverImageUrl } : undefined}
            style={[styles.thumb, { backgroundColor: restaurant.tone || '#7C2D12' }]}
            imageStyle={styles.thumbImage}
          >
            <View style={styles.thumbOverlay} />
            <View style={styles.thumbBadgeRow}>
              <View style={styles.thumbBadge}>
                <Text style={styles.thumbBadgeText}>{restaurant.etaMinutes || 35} мин</Text>
              </View>
              <View style={styles.thumbBadge}>
                <Text style={styles.thumbBadgeText}>★ {Number(restaurant.rating || 5).toFixed(1)}</Text>
              </View>
            </View>
            <View style={styles.thumbContent}>
              <Text style={styles.thumbTitle}>{restaurant.name}</Text>
              <Text style={styles.thumbSubtitle}>{restaurant.cuisine || 'Кухня уточняется'}</Text>
            </View>
          </ImageBackground>
          <Text style={styles.restaurantName}>{restaurant.name}</Text>
          <Text style={styles.restaurantMeta}>{restaurant.description || restaurant.cuisine || 'Без описания'}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaChip}>★ {Number(restaurant.rating || 5).toFixed(1)}</Text>
            <Text style={styles.metaChip}>{restaurant.etaMinutes || 35} мин</Text>
            <Text style={styles.metaChip}>от {Math.round(Number(restaurant.minOrder || 0))} тг</Text>
          </View>
        </TouchableOpacity>
      ))}

      <ServiceCard compact>
        <InlineLabel label="Новая вертикаль" value="Merchant + Menu + FoodOrder" accentColor="#FB923C" />
        <InlineLabel label="Пассажирский flow" value="Каталог -> Корзина -> Checkout -> Статус" />
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
  heroBlock: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  heroTitle: {
    color: '#F4F4F5',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    marginBottom: 8,
  },
  heroText: {
    color: '#A1A1AA',
    fontSize: 15,
    lineHeight: 22,
  },
  cuisineWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cuisinePill: {
    backgroundColor: '#1C1917',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  cuisinePillText: {
    color: '#FDBA74',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  restaurantCard: {
    backgroundColor: '#18181B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 14,
    marginBottom: 14,
  },
  thumb: {
    borderRadius: 18,
    marginBottom: 12,
    minHeight: 160,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  thumbImage: {
    borderRadius: 18,
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 9, 11, 0.28)',
  },
  thumbBadgeRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  thumbBadge: {
    backgroundColor: 'rgba(9, 9, 11, 0.72)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  thumbBadgeText: {
    color: '#FAFAF9',
    fontSize: 11,
    fontWeight: '800',
  },
  thumbContent: {
    padding: 18,
  },
  thumbTitle: {
    color: '#FAFAF9',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
  },
  thumbSubtitle: {
    color: '#FED7AA',
    fontSize: 13,
    fontWeight: '700',
  },
  restaurantName: {
    color: '#F4F4F5',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  restaurantMeta: {
    color: '#A1A1AA',
    fontSize: 14,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    color: '#E7E5E4',
    backgroundColor: '#292524',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    color: '#A1A1AA',
    fontSize: 15,
    lineHeight: 22,
  },
});
