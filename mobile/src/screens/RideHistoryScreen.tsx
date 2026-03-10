import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { apiClient } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'RideHistory'>;

interface Ride {
  id: string;
  status: string;
  fromAddress: string;
  toAddress: string;
  estimatedPrice?: number | string;
  finalPrice?: number | string;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  SEARCHING_DRIVER: 'Поиск',
  DRIVER_ASSIGNED: 'Назначен',
  ON_THE_WAY: 'В пути',
  IN_PROGRESS: 'В поездке',
  COMPLETED: 'Завершена',
  CANCELED: 'Отменена',
};

export const RideHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get('/rides/my');
        setRides(res.data);
      } catch {
        setRides([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatDate = (s: string) => {
    const d = new Date(s);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderItem = ({ item }: { item: Ride }) => {
    const price = item.finalPrice ?? item.estimatedPrice;
    const priceStr =
      price != null ? `${Math.round(Number(price))} ₽` : '';
    return (
      <View style={styles.item}>
        <Text style={styles.route}>
          {item.fromAddress} → {item.toAddress}
        </Text>
        <View style={styles.row}>
          <Text style={styles.status}>{statusLabels[item.status] ?? item.status}</Text>
          {priceStr ? <Text style={styles.price}>{priceStr}</Text> : null}
        </View>
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>История поездок</Text>
      <FlatList
        data={rides}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>Нет поездок</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  item: {
    padding: 16,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  route: {
    fontSize: 16,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  status: {
    fontSize: 14,
    color: '#666',
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
    color: '#666',
  },
});
