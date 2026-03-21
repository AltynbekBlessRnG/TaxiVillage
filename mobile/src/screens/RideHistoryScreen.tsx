import React, { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
  DRIVER_ARRIVED: 'На месте',
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

  const formatDate = (value: string) => {
    const date = new Date(value);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderItem = ({ item }: { item: Ride }) => {
    const price = item.finalPrice ?? item.estimatedPrice;
    const priceStr = price != null ? `${Math.round(Number(price))} ₽` : '';
    return (
      <View style={styles.item}>
        <Text style={styles.route}>{item.fromAddress} → {item.toAddress}</Text>
        <View style={styles.row}>
          <Text style={styles.status}>{statusLabels[item.status] ?? item.status}</Text>
          {priceStr ? <Text style={styles.price}>{priceStr}</Text> : null}
        </View>
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>История поездок</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.empty}>Нет поездок</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButtonText: { color: '#A1A1AA', fontSize: 14, fontWeight: '600' },
  title: { color: '#F4F4F5', fontSize: 22, fontWeight: '800' },
  headerSpacer: { width: 72 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#71717A', fontSize: 15 },
  listContent: { paddingHorizontal: 16, paddingBottom: 28 },
  item: {
    padding: 18,
    marginBottom: 12,
    backgroundColor: '#18181B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  route: { fontSize: 16, marginBottom: 10, color: '#F4F4F5', fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  status: { fontSize: 14, color: '#A1A1AA' },
  price: { fontSize: 16, fontWeight: '800', color: '#F4F4F5' },
  date: { fontSize: 12, color: '#71717A' },
  empty: { textAlign: 'center', marginTop: 40, color: '#71717A', fontSize: 15 },
});
