import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Socket } from 'socket.io-client';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createIntercitySocket } from '../../api/intercitySocket';
import { loadAuth } from '../../storage/authStorage';
import { formatIntercityDateTime } from '../../constants/intercity';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityMyTrips'>;

const statusLabels: Record<string, string> = {
  PLANNED: 'Запланирован',
  BOARDING: 'Посадка',
  IN_PROGRESS: 'В пути',
  COMPLETED: 'Завершен',
  CANCELED: 'Отменен',
};

export const IntercityMyTripsScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [currentTrip, setCurrentTrip] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [currentRes, tripsRes] = await Promise.all([
        apiClient.get('/intercity-trips/current').catch(() => ({ data: null })),
        apiClient.get('/intercity-trips/my').catch(() => ({ data: [] })),
      ]);
      setCurrentTrip(currentRes.data || null);
      setTrips(Array.isArray(tripsRes.data) ? tripsRes.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData().catch(() => null);
      return undefined;
    }, [loadData]),
  );

  useEffect(() => {
    let mounted = true;
    let socket: Socket | null = null;

    const setupSocket = async () => {
      const auth = await loadAuth();
      if (!auth?.accessToken || !mounted) {
        return;
      }

      socket = createIntercitySocket(auth.accessToken);
      socket.on('intercity-trip:updated', () => {
        if (!mounted) {
          return;
        }
        loadData().catch(() => null);
      });
      socket.on('intercity-booking:updated', () => {
        if (!mounted) {
          return;
        }
        loadData().catch(() => null);
      });
    };

    setupSocket().catch(() => null);

    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, [loadData]);

  const orderedTrips = useMemo(() => {
    const rest = trips.filter((trip) => trip.id !== currentTrip?.id);
    return currentTrip ? [currentTrip, ...rest] : rest;
  }, [currentTrip, trips]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Мои рейсы</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {orderedTrips.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Пока нет межгородних рейсов</Text>
          </View>
        ) : (
          orderedTrips.map((trip, index) => {
            const bookedSeats = Array.isArray(trip.bookings)
              ? trip.bookings.reduce((sum: number, booking: any) => sum + Number(booking.seatsBooked || 0), 0)
              : 0;
            const isCurrent = currentTrip?.id === trip.id && index === 0;

            return (
              <TouchableOpacity
                key={trip.id}
                style={[styles.tripCard, isCurrent && styles.tripCardCurrent]}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('IntercityTrip', { tripId: trip.id })}
              >
                {isCurrent ? (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Активный рейс</Text>
                  </View>
                ) : null}
                <Text style={styles.routeText}>{`${trip.fromCity || '-'} → ${trip.toCity || '-'}`}</Text>
                <Text style={styles.metaText}>{formatIntercityDateTime(trip.departureAt)}</Text>
                <Text style={styles.metaText}>
                  {statusLabels[trip.status] || trip.status} • {Math.round(Number(trip.pricePerSeat || 0))} ₸ за место
                </Text>
                <Text style={styles.metaText}>
                  Пассажиров: {Array.isArray(trip.bookings) ? trip.bookings.length : 0} • Мест занято: {bookedSeats} из {trip.seatCapacity || 0}
                </Text>
                <View style={styles.openRow}>
                  <Text style={styles.openLabel}>Открыть рейс</Text>
                  <Ionicons name="chevron-forward" size={22} color={colors.accentText} style={styles.openArrow} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('IntercityRequests')}
          activeOpacity={0.9}
        >
          <Text style={styles.secondaryButtonText}>Заявки пассажиров</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('IntercityTrip', {})}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryButtonText}>Создать свой рейс</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 18,
  },
  backText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 140,
    gap: 14,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 18,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  tripCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 18,
  },
  tripCardCurrent: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  currentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSurface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  currentBadgeText: {
    color: colors.accentText,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  routeText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  openRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  openLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  openArrow: {
    color: colors.accentText,
    fontSize: 22,
    fontWeight: '800',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '900',
  },
});
