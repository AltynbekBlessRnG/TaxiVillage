import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface Props {
  activeRide?: any | null;
  activeCourierOrder?: any | null;
  etaSeconds?: number | null;
  rideUnreadCount?: number;
  onOpenRideChat?: () => void;
  onCancel?: () => void;
}

const ACTIVE_CANCELABLE_STATUSES = ['SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'ON_THE_WAY', 'DRIVER_ARRIVED'];

export const ActiveOrderSheet: React.FC<Props> = ({
  activeRide,
  activeCourierOrder,
  etaSeconds,
  rideUnreadCount = 0,
  onOpenRideChat,
  onCancel,
}) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const isCourier = !!activeCourierOrder;
  const status = activeRide?.status ?? activeCourierOrder?.status;
  const snapPoints = useMemo(() => {
    if (activeRide) {
      return ['31%', '55%'];
    }
    return ['28%', '48%'];
  }, [activeRide]);

  useEffect(() => {
    requestAnimationFrame(() => {
      bottomSheetRef.current?.snapToIndex(0);
    });
  }, [activeRide, activeCourierOrder]);

  const etaMinutes = etaSeconds ? Math.max(1, Math.round(etaSeconds / 60)) : null;
  const driverName = activeRide?.driver?.fullName || 'Водитель';
  const carInfo = [activeRide?.driver?.car?.color, activeRide?.driver?.car?.make, activeRide?.driver?.car?.model]
    .filter(Boolean)
    .join(' ');
  const plate = activeRide?.driver?.car?.plateNumber || '—';

  return (
    <View style={styles.fullOverlay} pointerEvents="box-none">
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        enableDynamicSizing={false}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        backgroundStyle={styles.background}
        style={styles.sheetShadow}
      >
        <BottomSheetView style={styles.content}>
          <View style={styles.headlineCard}>
            <Text style={styles.headlineText}>
              {isCourier
                ? courierHeadline(status, etaMinutes)
                : rideHeadline(status, etaMinutes, activeRide?.driver?.car)}
            </Text>
          </View>

          {activeRide?.driver ? (
            <View style={styles.driverCard}>
              <View style={styles.driverMeta}>
                <Text style={styles.driverName}>{driverName}</Text>
                <Text style={styles.driverCar}>{carInfo || 'Автомобиль в пути'}</Text>
              </View>
              <View style={styles.plateBox}>
                <Text style={styles.plateText}>{plate}</Text>
              </View>
            </View>
          ) : null}

          {activeRide ? (
            <View style={styles.routeCard}>
              <Text style={styles.sectionLabel}>Подача</Text>
              <View style={styles.routeRow}>
                <View style={styles.routeDotBlue} />
                <Text style={styles.addressText} numberOfLines={1}>
                  {activeRide.fromAddress}
                </Text>
              </View>
              {(activeRide?.stops ?? []).map((stop: any, index: number) => (
                <View key={`${stop.address}-${index}`} style={styles.routeRow}>
                  <View style={styles.routeDotStop} />
                  <Text style={styles.addressText} numberOfLines={1}>
                    {stop.address}
                  </Text>
                </View>
              ))}
              <View style={styles.routeDivider} />
              <Text style={styles.sectionLabel}>Прибытие</Text>
              <View style={styles.routeRow}>
                <View style={styles.routeDotRed} />
                <Text style={styles.addressText} numberOfLines={1}>
                  {activeRide.toAddress}
                </Text>
              </View>
            </View>
          ) : activeCourierOrder ? (
            <View style={styles.routeCard}>
              <Text style={styles.sectionLabel}>Забрать</Text>
              <View style={styles.routeRow}>
                <View style={styles.routeDotBlue} />
                <Text style={styles.addressText} numberOfLines={1}>
                  {activeCourierOrder.pickupAddress}
                </Text>
              </View>
              <View style={styles.routeDivider} />
              <Text style={styles.sectionLabel}>Доставить</Text>
              <View style={styles.routeRow}>
                <View style={styles.routeDotRed} />
                <Text style={styles.addressText} numberOfLines={1}>
                  {activeCourierOrder.dropoffAddress}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.bottomBar}>
            <View style={styles.priceBlock}>
              <Text style={styles.priceLabel}>{isCourier ? 'Доставка' : 'Поездка'}</Text>
              <Text style={styles.priceValue}>
                {Math.round(Number(activeRide?.finalPrice || activeRide?.estimatedPrice || activeCourierOrder?.estimatedPrice || 0))} ₸
              </Text>
            </View>

            <View style={styles.actionRow}>
              {activeRide?.driver && onOpenRideChat ? (
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={onOpenRideChat}
                  accessibilityRole="button"
                  accessibilityLabel={
                    rideUnreadCount > 0
                      ? `Чат с водителем, непрочитанных: ${rideUnreadCount}`
                      : 'Чат с водителем'
                  }
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.textInverse} />
                  {rideUnreadCount > 0 ? (
                    <View style={styles.chatBadge}>
                      <Text style={styles.chatBadgeText}>{rideUnreadCount > 99 ? '99+' : rideUnreadCount}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ) : null}

              {((activeRide && ACTIVE_CANCELABLE_STATUSES.includes(activeRide.status)) ||
                (activeCourierOrder && activeCourierOrder.status !== 'DELIVERED' && activeCourierOrder.status !== 'CANCELED')) && onCancel ? (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={onCancel}
                  accessibilityRole="button"
                  accessibilityLabel={isCourier ? 'Отменить доставку' : 'Отменить поездку'}
                >
                  <Ionicons name="close-outline" size={20} color={colors.dangerTextStrong} />
                  <Text style={styles.secondaryButtonText}>Отменить</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
};

function rideHeadline(status: string, etaMinutes: number | null, car?: any) {
  if (status === 'DRIVER_ASSIGNED' || status === 'ON_THE_WAY') {
    const carLabel = [car?.color, car?.make, car?.model].filter(Boolean).join(' ');
    return `Через ~${etaMinutes ?? 3} мин приедет ${carLabel || 'водитель'}`;
  }
  if (status === 'DRIVER_ARRIVED') {
    return 'Водитель уже на месте';
  }
  if (status === 'IN_PROGRESS') {
    return 'Вы в пути';
  }
  if (status === 'COMPLETED') {
    return 'Поездка завершена';
  }
  if (status === 'CANCELED') {
    return 'Заказ отменен';
  }
  return 'Ищем водителя';
}

function courierHeadline(status: string, etaMinutes: number | null) {
  if (status === 'TO_PICKUP') {
    return `Через ~${etaMinutes ?? 3} мин приедет курьер`;
  }
  if (status === 'COURIER_ARRIVED') {
    return 'Курьер уже на месте';
  }
  if (status === 'TO_RECIPIENT') {
    return 'Курьер в пути к получателю';
  }
  if (status === 'DELIVERED') {
    return 'Доставка завершена';
  }
  if (status === 'CANCELED') {
    return 'Заказ отменен';
  }
  return 'Ищем курьера';
}

const styles = StyleSheet.create({
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 700,
    pointerEvents: 'box-none',
  },
  sheetShadow: {
    zIndex: 700,
    elevation: 24,
  },
  background: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    paddingTop: 10,
  },
  handleIndicator: {
    backgroundColor: colors.surfacePressed,
    width: 42,
    height: 4,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 26,
    paddingTop: 2,
  },
  headlineCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headlineText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  driverCard: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
  },
  driverMeta: {
    flex: 1,
    marginRight: 12,
  },
  driverName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
  },
  driverCar: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  plateBox: {
    backgroundColor: colors.surfaceInverse,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  plateText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  routeCard: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeDotBlue: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
    backgroundColor: colors.info,
  },
  routeDotStop: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
    backgroundColor: colors.foodStrong,
  },
  routeDotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
    backgroundColor: colors.danger,
  },
  addressText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  routeDivider: {
    height: 1,
    backgroundColor: colors.surfaceRaised,
    marginVertical: 10,
  },
  bottomBar: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceBlock: {
    flex: 1,
    marginRight: 12,
  },
  priceLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  priceValue: {
    color: colors.infoText,
    fontSize: 24,
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.surfaceInverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
  },
  secondaryButtonText: {
    color: colors.dangerTextStrong,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  chatBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.dangerStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
});
