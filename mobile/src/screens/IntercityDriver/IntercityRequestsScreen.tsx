import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Socket } from 'socket.io-client';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createIntercitySocket } from '../../api/intercitySocket';
import { loadAuth } from '../../storage/authStorage';
import { DarkAlertModal } from '../../components/DarkAlertModal';
import { formatIntercityDateTime } from '../../constants/intercity';
import { OptionPickerModal } from '../../components/OptionPickerModal';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityRequests'>;

export const IntercityRequestsScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [myTrips, setMyTrips] = useState<any[]>([]);
  const [inviteTargetOrder, setInviteTargetOrder] = useState<any | null>(null);
  const [modal, setModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: '',
  });

  const loadData = useCallback(async () => {
    try {
      const [availableRes, myOrdersRes, myTripsRes] = await Promise.all([
        apiClient.get('/intercity-orders/available'),
        apiClient.get('/intercity-orders/driver/my').catch(() => ({ data: [] })),
        apiClient.get('/intercity-trips/my').catch(() => ({ data: [] })),
      ]);
      setAvailableOrders(Array.isArray(availableRes.data) ? availableRes.data : []);
      const myOrders = Array.isArray(myOrdersRes.data) ? myOrdersRes.data : [];
      setActiveOrder(
        myOrders.find((order: any) =>
          ['CONFIRMED', 'DRIVER_EN_ROUTE', 'BOARDING', 'IN_PROGRESS'].includes(order.status),
        ) ?? null,
      );
      const nextTrips = Array.isArray(myTripsRes.data) ? myTripsRes.data : [];
      setMyTrips(nextTrips.filter((trip: any) => trip.status === 'PLANNED'));
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось загрузить заявки пассажиров';
      setAvailableOrders([]);
      setActiveOrder(null);
      setMyTrips([]);
      setModal({
        visible: true,
        title: 'Межгород',
        message: Array.isArray(message) ? message.join(', ') : message,
      });
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
      socket.on('intercity-order:updated', () => {
        if (!mounted) {
          return;
        }
        loadData().catch(() => null);
      });
      socket.on('intercity-trip:updated', () => {
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

  const acceptOrder = useCallback(
    async (orderId: string) => {
      try {
        await apiClient.post(`/intercity-orders/${orderId}/accept`);
        await loadData();
        navigation.navigate('IntercityDriverOrder', { orderId });
      } catch (error: any) {
        const message = error?.response?.data?.message || 'Не удалось взять заявку';
        setModal({
          visible: true,
          title: 'Ошибка',
          message: Array.isArray(message) ? message.join(', ') : message,
        });
      }
    },
    [loadData, navigation],
  );

  const inviteToTrip = useCallback(
    async (tripId: string, orderId: string) => {
      try {
        await apiClient.post(`/intercity-trips/${tripId}/invite-order`, { orderId });
        setInviteTargetOrder(null);
        setModal({
          visible: true,
          title: 'Приглашение отправлено',
          message: 'Пассажир увидит приглашение в свой рейс и сможет принять его или отказаться.',
        });
        await loadData();
      } catch (error: any) {
        const message = error?.response?.data?.message || 'Не удалось отправить приглашение';
        setModal({
          visible: true,
          title: 'Ошибка',
          message: Array.isArray(message) ? message.join(', ') : message,
        });
      }
    },
    [loadData],
  );

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
        <Text style={styles.title}>Заявки пассажиров</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeOrder ? (
          <TouchableOpacity
            style={[styles.orderCard, styles.activeOrderCard]}
            activeOpacity={0.92}
            onPress={() => navigation.navigate('IntercityDriverOrder', { orderId: activeOrder.id })}
          >
            <Text style={styles.activeEyebrow}>Активная заявка</Text>
            <Text style={styles.routeText}>{`${activeOrder.fromCity} → ${activeOrder.toCity}`}</Text>
            <Text style={styles.metaText}>{formatIntercityDateTime(activeOrder.departureAt)}</Text>
            <Text style={styles.metaText}>{activeOrder.passenger?.fullName || activeOrder.passenger?.user?.phone || 'Пассажир'}</Text>
            <TouchableOpacity
              style={styles.takeButton}
              onPress={() => navigation.navigate('IntercityDriverOrder', { orderId: activeOrder.id })}
              activeOpacity={0.9}
            >
              <Text style={styles.takeButtonText}>Открыть заявку</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ) : null}

        {availableOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Сейчас нет новых заявок</Text>
          </View>
        ) : (
          availableOrders.map((order) => (
            <TouchableOpacity key={order.id} style={styles.orderCard} activeOpacity={0.92}>
              <Text style={styles.routeText}>{`${order.fromCity} → ${order.toCity}`}</Text>
              <Text style={styles.metaText}>
                {formatIntercityDateTime(order.departureAt)} • {Math.round(Number(order.price || 0))} ₸
              </Text>
              <Text style={styles.metaText}>
                {order.passenger?.fullName || order.passenger?.user?.phone || 'Пассажир'} • Мест: {order.seats}
              </Text>
              <Text style={styles.metaText}>Багаж: {order.baggage || 'Не указан'}</Text>
              {order.comment ? <Text style={styles.commentText}>{order.comment}</Text> : null}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.takeButton, styles.halfAction]}
                  onPress={() => acceptOrder(order.id)}
                  activeOpacity={0.9}
                >
                  <Text style={styles.takeButtonText}>Взять заявку</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inviteButton, styles.halfAction, myTrips.length === 0 && styles.inviteButtonDisabled]}
                  onPress={() => {
                    if (myTrips.length === 0) {
                      setModal({
                        visible: true,
                        title: 'Нет своего рейса',
                        message: 'Сначала создай свой рейс, чтобы приглашать пассажиров в салон.',
                      });
                      return;
                    }
                    setInviteTargetOrder(order);
                  }}
                  activeOpacity={0.9}
                >
                  <Text style={styles.inviteButtonText}>Позвать в рейс</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('IntercityMyTrips')}
          activeOpacity={0.9}
        >
          <Text style={styles.secondaryButtonText}>Мои рейсы</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('IntercityTrip', {})}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryButtonText}>Создать свой рейс</Text>
        </TouchableOpacity>
      </View>
      <DarkAlertModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        primaryLabel="Понятно"
        onPrimary={() => setModal({ visible: false, title: '', message: '' })}
      />
      <OptionPickerModal
        visible={Boolean(inviteTargetOrder)}
        title="Выбери свой рейс"
        options={myTrips.map((trip) => ({
          value: trip.id,
          label: `${trip.fromCity} → ${trip.toCity} • ${formatIntercityDateTime(trip.departureAt)}`,
        }))}
        onSelect={(tripId) => {
          if (inviteTargetOrder) {
            inviteToTrip(tripId, inviteTargetOrder.id).catch(() => null);
          }
        }}
        selectedValue={undefined}
        onClose={() => setInviteTargetOrder(null)}
      />
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
    paddingBottom: 12,
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
    fontSize: 30,
    lineHeight: 36,
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
  orderCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 18,
  },
  activeOrderCard: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  activeEyebrow: {
    color: colors.accentText,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 8,
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
  commentText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  halfAction: {
    flex: 1,
    marginTop: 0,
  },
  takeButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  takeButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  inviteButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteButtonDisabled: {
    opacity: 0.6,
  },
  inviteButtonText: {
    color: colors.infoTextSoft,
    fontSize: 15,
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
