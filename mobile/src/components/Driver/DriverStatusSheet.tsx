import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';

interface DriverStatusSheetProps {
  isOnline: boolean;
  currentRideId: string | null;
  currentRide?: any;
  profile: any;
  onSwitchMode: (mode: 'TAXI' | 'COURIER') => void;
  currentCourierOrder?: any;
  availableCourierOrders?: any[];
  onAcceptCourierOrder?: (orderId: string) => void;
  onRideStatusChange?: (status: string) => void;
  onCompleteRide?: () => void;
  onCancelRide?: () => void;
  onCourierStatusChange?: (status: string) => void;
  metrics?: {
    todayEarnings?: number;
    dailyBuckets?: Array<{ date: string; label: string; earnings: number }>;
    completedTaxiRides?: number;
    completedCourierDeliveries?: number;
    rating?: number;
    balance?: number;
  } | null;
}

export const DriverStatusSheet: React.FC<DriverStatusSheetProps> = ({
  isOnline,
  currentRideId,
  currentRide,
  profile,
  onSwitchMode,
  currentCourierOrder,
  availableCourierOrders = [],
  onAcceptCourierOrder,
  onRideStatusChange,
  onCompleteRide,
  onCancelRide,
  onCourierStatusChange,
  metrics,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const maxEarnings = Math.max(...(metrics?.dailyBuckets?.map((bucket) => bucket.earnings) ?? [0]), 1);

  useEffect(() => {
    if (isOnline && !currentRideId) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.2, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOnline, currentRideId]);

  if (currentRide || currentCourierOrder) {
    const rideStatus = currentRide?.status;
    const courierStatus = currentCourierOrder?.status;

    return (
      <View style={styles.container}>
        <View style={styles.workspace}>
          <View style={[styles.activeCard, currentCourierOrder && styles.activeCardCourier]}>
            <View style={styles.row}>
              <View style={[styles.dotGreen, currentCourierOrder && styles.dotCourier]} />
              <Text style={styles.activeText}>
                {currentCourierOrder ? 'Активная доставка' : 'Активный заказ'}
              </Text>
            </View>

            {currentRide ? (
              <>
                <Text style={styles.priceTitle}>{Math.round(Number(currentRide?.finalPrice ?? currentRide?.estimatedPrice ?? 0))} ₸</Text>
                <View style={styles.routeCardActive}>
                  <View style={styles.routePoint}>
                    <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
                    <Text style={styles.routeText}>{currentRide?.fromAddress || '-'}</Text>
                  </View>
                  {(currentRide?.stops ?? []).map((stop: any, index: number) => (
                    <View key={`${stop.address}-${index}`} style={styles.routePoint}>
                      <View style={[styles.dot, { backgroundColor: '#F97316' }]} />
                      <Text style={styles.routeText}>Заезд: {stop.address}</Text>
                    </View>
                  ))}
                  <View style={styles.routePoint}>
                    <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.routeText}>{currentRide?.toAddress || '-'}</Text>
                  </View>
                  {currentRide?.comment ? (
                    <Text style={styles.commentText}>Комментарий: {currentRide.comment}</Text>
                  ) : null}
                </View>

                {(rideStatus === 'ON_THE_WAY' || rideStatus === 'DRIVER_ASSIGNED') ? (
                  <TouchableOpacity style={[styles.actionButton, styles.arrivedButton]} onPress={() => onRideStatusChange?.('DRIVER_ARRIVED')}>
                    <Text style={styles.actionButtonText}>Я на месте</Text>
                  </TouchableOpacity>
                ) : null}

                {rideStatus === 'DRIVER_ARRIVED' ? (
                  <TouchableOpacity style={[styles.actionButton, styles.inProgressButton]} onPress={() => onRideStatusChange?.('IN_PROGRESS')}>
                    <Text style={styles.actionButtonText}>В путь</Text>
                  </TouchableOpacity>
                ) : null}

                {rideStatus === 'IN_PROGRESS' ? (
                  <TouchableOpacity style={[styles.actionButton, styles.completeButton]} onPress={onCompleteRide}>
                    <Text style={styles.completeButtonText}>Завершить поездку</Text>
                  </TouchableOpacity>
                ) : null}

                {(rideStatus === 'ON_THE_WAY' || rideStatus === 'DRIVER_ASSIGNED' || rideStatus === 'DRIVER_ARRIVED') ? (
                  <TouchableOpacity style={styles.cancelButton} onPress={onCancelRide}>
                    <Text style={styles.cancelButtonText}>Отменить заказ</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : null}

            {currentCourierOrder ? (
              <>
                <View style={styles.routeCardActive}>
                  <View style={styles.routePoint}>
                    <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
                    <Text style={styles.routeText}>{currentCourierOrder?.pickupAddress || '-'}</Text>
                  </View>
                  <View style={styles.routePoint}>
                    <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.routeText}>{currentCourierOrder?.dropoffAddress || '-'}</Text>
                  </View>
                </View>

                <View style={styles.detailsBlock}>
                  <Text style={styles.detailLabel}>Посылка</Text>
                  <Text style={styles.detailValue}>{currentCourierOrder?.itemDescription || '-'}</Text>
                  <Text style={styles.detailLabel}>Вес</Text>
                  <Text style={styles.detailValue}>{currentCourierOrder?.packageWeight || 'Не указан'}</Text>
                  {currentCourierOrder?.packageSize ? (
                    <>
                      <Text style={styles.detailLabel}>Размер</Text>
                      <Text style={styles.detailValue}>{currentCourierOrder.packageSize}</Text>
                    </>
                  ) : null}
                  {currentCourierOrder?.comment ? (
                    <>
                      <Text style={styles.detailLabel}>Комментарий</Text>
                      <Text style={styles.detailValue}>{currentCourierOrder.comment}</Text>
                    </>
                  ) : null}
                  <Text style={styles.detailLabel}>Цена</Text>
                  <Text style={styles.priceCourier}>{Math.round(Number(currentCourierOrder?.estimatedPrice || 0))} ₸</Text>
                </View>

                {courierStatus === 'TO_PICKUP' ? (
                  <TouchableOpacity style={[styles.actionButton, styles.arrivedButtonCourier]} onPress={() => onCourierStatusChange?.('COURIER_ARRIVED')}>
                    <Text style={styles.actionButtonText}>На месте</Text>
                  </TouchableOpacity>
                ) : null}

                {(courierStatus === 'COURIER_ARRIVED' || courierStatus === 'PICKED_UP') ? (
                  <TouchableOpacity style={[styles.actionButton, styles.inProgressButton]} onPress={() => onCourierStatusChange?.('TO_RECIPIENT')}>
                    <Text style={styles.actionButtonText}>Еду к получателю</Text>
                  </TouchableOpacity>
                ) : null}

                {(courierStatus === 'TO_RECIPIENT' || courierStatus === 'DELIVERING') ? (
                  <TouchableOpacity style={[styles.actionButton, styles.completeButton]} onPress={() => onCourierStatusChange?.('DELIVERED')}>
                    <Text style={styles.completeButtonText}>Доставлено</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.workspace}>
        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.modeTab, profile?.driverMode === 'TAXI' && styles.modeTabActive]}
            onPress={() => onSwitchMode('TAXI')}
            disabled={profile?.driverMode === 'TAXI'}
            activeOpacity={profile?.driverMode === 'TAXI' ? 1 : 0.85}
          >
            <Text style={[styles.modeTabText, profile?.driverMode === 'TAXI' && styles.modeTabTextActive]}>
              Такси
            </Text>
          </TouchableOpacity>
          {profile?.supportsCourier ? (
            <TouchableOpacity
              style={[styles.modeTab, profile?.driverMode === 'COURIER' && styles.modeTabActiveCourier]}
              onPress={() => onSwitchMode('COURIER')}
              disabled={profile?.driverMode === 'COURIER'}
              activeOpacity={profile?.driverMode === 'COURIER' ? 1 : 0.85}
            >
              <Text style={[styles.modeTabText, profile?.driverMode === 'COURIER' && styles.modeTabTextActive]}>
                Курьер
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        
        {/* СТАТУС */}
        <View style={styles.statusRow}>
          <Animated.View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : '#71717A', opacity: pulseAnim }]} />
          <Text style={styles.statusText}>
            {isOnline ? (profile?.driverMode === 'COURIER' ? 'Поиск доставок...' : 'Поиск заказов...') : 'Офлайн — отдых'}
          </Text>
        </View>

        {profile?.driverMode === 'COURIER' && availableCourierOrders.length > 0 ? (
          <View style={styles.offerBlock}>
            <Text style={styles.offerTitle}>Доступные доставки</Text>
            {availableCourierOrders.slice(0, 2).map((order) => (
              <TouchableOpacity key={order.id} style={styles.offerCard} onPress={() => onAcceptCourierOrder?.(order.id)}>
                <Text style={styles.offerRoute}>{order.pickupAddress}</Text>
                <Text style={styles.offerMeta}>
                  {order.dropoffAddress} • {Math.round(Number(order.estimatedPrice || 0))} тг
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Статистика за 7 дней</Text>
          <View style={styles.chartRow}>
            {(metrics?.dailyBuckets ?? []).map((bucket) => (
              <View key={bucket.date} style={styles.chartItem}>
                <View style={styles.chartTrack}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: `${Math.max(8, Math.round((bucket.earnings / maxEarnings) * 100))}%`,
                        backgroundColor: profile?.driverMode === 'COURIER' ? '#F59E0B' : '#3B82F6',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.chartValue}>{Math.round(bucket.earnings)}</Text>
                <Text style={styles.chartLabel}>{bucket.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* КАРТОЧКА "СЕГОДНЯ" */}
        <TouchableOpacity style={styles.card}>
          <Text style={styles.cardTitle}>Сегодня</Text>
          <View style={styles.cardRight}>
            <Text style={styles.cardValue}>{Math.round(Number(metrics?.todayEarnings ?? 0))} ₸</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </TouchableOpacity>

        {/* КАРТОЧКА "МЕТРИКИ" (Баланс, Активность, Рейтинг) */}
        <View style={styles.metricsCard}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Баланс</Text>
            <Text style={styles.metricValueWhite}>{Math.round(Number(metrics?.balance ?? profile?.balance ?? 0))} ₸</Text>
          </View>
          
          <View style={styles.verticalDivider} />
          
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Завершено</Text>
            <Text style={styles.metricValueWhite}>
              {(metrics?.completedTaxiRides ?? 0) + (metrics?.completedCourierDeliveries ?? 0)}
            </Text>
          </View>
          
          <View style={styles.verticalDivider} />
          
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Рейтинг</Text>
            <Text style={styles.metricValueYellow}>{Number(metrics?.rating ?? profile?.rating ?? 5).toFixed(1)} ★</Text>
          </View>
        </View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 },
  workspace: { 
    backgroundColor: '#09090B', 
    padding: 16, // Уменьшили отступы, чтобы всё влезло
    paddingBottom: 24, // Уменьшили нижний отступ
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    borderTopWidth: 1, 
    borderColor: '#27272A' 
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 6,
    gap: 6,
    marginBottom: 14,
  },
  modeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
  },
  modeTabActive: {
    backgroundColor: '#27272A',
  },
  modeTabActiveCourier: {
    backgroundColor: '#3F2B05',
  },
  modeTabText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '800',
  },
  modeTabTextActive: {
    color: '#F4F4F5',
  },
  
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, justifyContent: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  statusText: { color: '#F4F4F5', fontSize: 15, fontWeight: '600' },

  infoCard: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  infoTitle: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  infoText: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 18,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 8,
  },
  chartItem: {
    flex: 1,
    alignItems: 'center',
  },
  chartTrack: {
    width: '100%',
    height: 72,
    borderRadius: 12,
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 6,
  },
  chartBar: {
    width: '100%',
    borderRadius: 10,
    minHeight: 6,
  },
  chartValue: {
    color: '#F4F4F5',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },
  chartLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  card: { 
    backgroundColor: '#18181B', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 10, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A'
  },
  cardTitle: { color: '#F4F4F5', fontSize: 16, fontWeight: '600' },
  cardRight: { flexDirection: 'row', alignItems: 'center' },
  cardValue: { color: '#F4F4F5', fontSize: 18, fontWeight: '800' },
  chevron: { color: '#71717A', fontSize: 22, marginLeft: 10, marginTop: -2 },
  
  // Стили для новой тройной карточки
  // Стили для новой тройной карточки (ЖЕЛЕЗОБЕТОННЫЕ)
  metricsCard: {
    backgroundColor: '#18181B', 
    borderRadius: 16, 
    height: 76, // Жестко фиксируем высоту, чтобы она не растягивалась
    flexDirection: 'row', 
    justifyContent: 'space-evenly', // Равномерно распределяем
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A'
  },
  offerBlock: {
    marginBottom: 14,
  },
  offerTitle: {
    color: '#F4F4F5',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  offerCard: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  offerRoute: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  offerMeta: {
    color: '#A1A1AA',
    fontSize: 13,
  },
  metricBox: { 
    width: '30%', // Жестко задаем ширину вместо flex: 1
    alignItems: 'center',
    justifyContent: 'center'
  },
  verticalDivider: { 
    width: 1, 
    height: 36, 
    backgroundColor: '#27272A' 
  },
  metricLabel: { 
    color: '#71717A', 
    fontSize: 11, 
    textTransform: 'uppercase', 
    marginBottom: 4, 
    fontWeight: '600' 
  },
  metricValueWhite: { 
    color: '#F4F4F5', 
    fontSize: 16, 
    fontWeight: '800' 
  },
  metricValueYellow: { 
    color: '#F59E0B', 
    fontSize: 16, 
    fontWeight: '800' 
  },

  activeCard: { backgroundColor: '#09090B', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#27272A' },
  activeCardCourier: { backgroundColor: '#09090B', borderColor: '#27272A' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', marginRight: 10 },
  dotCourier: { backgroundColor: '#F59E0B' },
  activeText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  priceTitle: { color: '#F4F4F5', fontSize: 28, fontWeight: '900', marginTop: 8, marginBottom: 12 },
  routeCardActive: {
    backgroundColor: '#18181B',
    borderRadius: 18,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  routePoint: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  routeText: { color: '#E4E4E7', fontSize: 14, flex: 1, fontWeight: '600' },
  commentText: { color: '#A1A1AA', fontSize: 13, marginTop: 4 },
  detailsBlock: {
    backgroundColor: '#18181B',
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  detailLabel: { color: '#71717A', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginTop: 4, marginBottom: 2 },
  detailValue: { color: '#F4F4F5', fontSize: 14, fontWeight: '600' },
  priceCourier: { color: '#60A5FA', fontSize: 20, fontWeight: '900', marginTop: 2 },
  actionButton: { borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  actionButtonText: { color: '#09090B', fontSize: 17, fontWeight: '900' },
  arrivedButton: { backgroundColor: '#F59E0B' },
  arrivedButtonCourier: { backgroundColor: '#F59E0B' },
  inProgressButton: { backgroundColor: '#3B82F6' },
  completeButton: { backgroundColor: '#10B981' },
  completeButtonText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3F3F46',
    backgroundColor: '#1C1C1E',
  },
  cancelButtonText: { color: '#EF4444', fontSize: 15, fontWeight: '800' },
});
