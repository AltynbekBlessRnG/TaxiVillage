import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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

  useEffect(() => {
    apiClient
      .get('/merchants/public')
      .then((response) => setRestaurants(response.data))
      .finally(() => setLoading(false));
  }, []);

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
      subtitle="Каталог-first flow уже читает живой backend: сначала ресторан и меню, потом корзина и checkout."
      backLabel="К такси"
      onBack={() => navigation.goBack()}
    >
      <ServiceCard>
        <SectionTitle>Подборка на сегодня</SectionTitle>
        <ChipRow items={['Быстрая доставка', 'Плов', 'Суши', 'Бургеры', 'Семейный ужин']} />
      </ServiceCard>

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
          <View style={[styles.thumb, { backgroundColor: restaurant.tone || '#7C2D12' }]}>
            <Text style={styles.thumbTitle}>{restaurant.name}</Text>
            <Text style={styles.thumbSubtitle}>{restaurant.cuisine || 'Кухня уточняется'}</Text>
          </View>
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
    padding: 18,
    justifyContent: 'flex-end',
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
