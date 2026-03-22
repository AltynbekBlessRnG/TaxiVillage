import React, { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { apiClient } from '../api/client';
import { loadAuth } from '../storage/authStorage';

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
  DRIVER_ASSIGNED: 'Едет к клиенту',
  ON_THE_WAY: 'Едет к клиенту',
  DRIVER_ARRIVED: 'Водитель прибыл',
  IN_PROGRESS: 'Вы в пути',
  COMPLETED: 'Завершена',
  CANCELED: 'Отменена',
};

export const RideHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'PASSENGER' | 'DRIVER'>('PASSENGER');

  useEffect(() => {
    loadAuth().then((auth) => {
      if (auth?.role === 'DRIVER') {
        setRole('DRIVER');
      }
    });
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;

      const load = async () => {
        try {
          setLoading(true);
          const res = await apiClient.get('/rides/my');
          if (active) {
            setRides(res.data);
          }
        } catch {
          if (active) {
            setRides([]);
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

      load().catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

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
    const priceStr = price != null ? `${Math.round(Number(price))} ₸` : '';
    const isActiveRide = ['SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'ON_THE_WAY', 'DRIVER_ARRIVED', 'IN_PROGRESS'].includes(item.status);

    return (
      <TouchableOpacity
        style={styles.item}
        activeOpacity={isActiveRide ? 0.85 : 1}
        onPress={() => {
          if (!isActiveRide) {
            return;
          }

          navigation.navigate(role === 'DRIVER' ? 'DriverRide' : 'RideStatus', { rideId: item.id });
        }}
      >
        <Text style={styles.route}>{item.fromAddress} → {item.toAddress}</Text>
        <View style={styles.row}>
          <Text style={styles.status}>{statusLabels[item.status] ?? item.status}</Text>
          {priceStr ? <Text style={styles.price}>{priceStr}</Text> : null}
        </View>
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
        {isActiveRide ? <Text style={styles.openRideHint}>Открыть активную поездку</Text> : null}
      </TouchableOpacity>
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
  openRideHint: { marginTop: 10, fontSize: 12, color: '#60A5FA', fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40, color: '#71717A', fontSize: 15 },
});
