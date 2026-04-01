import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

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
  const snapPoints = useMemo(() => [activeRide ? '43%' : '35%'], [activeRide]);

  useEffect(() => {
    requestAnimationFrame(() => {
      bottomSheetRef.current?.snapToIndex(0);
    });
  }, [activeRide, activeCourierOrder]);

  const isCourier = !!activeCourierOrder;
  const status = activeRide?.status ?? activeCourierOrder?.status;

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
          <View style={styles.statusHeader}>
            <View style={[styles.statusDot, getStatusDotColor(status)]} />
            <Text style={styles.statusTitle}>
              {isCourier ? translateCourierStatus(status) : translateStatus(status)}
            </Text>
          </View>

          {activeRide && etaSeconds && (activeRide.status === 'ON_THE_WAY' || activeRide.status === 'DRIVER_ASSIGNED' || activeRide.status === 'DRIVER_ARRIVED') ? (
            <View style={styles.etaBadge}>
              <Text style={styles.etaLabel}>До подачи примерно</Text>
              <Text style={styles.etaValue}>{`${Math.max(1, Math.round(etaSeconds / 60))} мин`}</Text>
            </View>
          ) : null}

        {activeRide?.driver ? (
          <View style={styles.rideCard}>
            <View style={styles.driverRow}>
              <View>
                <Text style={styles.driverName}>{activeRide.driver.fullName || 'Водитель'}</Text>
                <Text style={styles.carInfo}>
                  {[activeRide.driver.car?.make, activeRide.driver.car?.model, activeRide.driver.car?.color].filter(Boolean).join(' • ')}
                </Text>
              </View>
              <View style={styles.plateBox}>
                <Text style={styles.plateText}>{activeRide.driver.car?.plateNumber || '—'}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {activeRide ? (
          <View style={styles.rideCard}>
            <View style={styles.routePointRow}>
              <View style={styles.routeDotBlue} />
              <Text style={styles.addressText} numberOfLines={1}>{activeRide.fromAddress}</Text>
            </View>
            {activeRide?.stops?.map((stop: any, index: number) => (
              <View key={`${stop.address}-${index}`} style={styles.routePointRow}>
                <View style={styles.routeDotStop} />
                <Text style={styles.addressText} numberOfLines={1}>{`Заезд: ${stop.address}`}</Text>
              </View>
            ))}
            <View style={styles.routePointRow}>
              <View style={styles.routeDotRed} />
              <Text style={styles.addressText} numberOfLines={1}>{activeRide.toAddress}</Text>
            </View>
            <View style={styles.rideDivider} />
            <View style={styles.priceRowActive}>
              <Text style={styles.priceLabel}>Стоимость поездки</Text>
              <Text style={styles.priceValue}>{Math.round(Number(activeRide.finalPrice || activeRide.estimatedPrice || 0))} ₸</Text>
            </View>
          </View>
        ) : activeCourierOrder ? (
          <View style={styles.rideCard}>
            <View style={styles.routePointRow}>
              <View style={styles.routeDotBlue} />
              <Text style={styles.addressText} numberOfLines={1}>{activeCourierOrder.pickupAddress}</Text>
            </View>
            <View style={styles.routePointRow}>
              <View style={styles.routeDotRed} />
              <Text style={styles.addressText} numberOfLines={1}>{activeCourierOrder.dropoffAddress}</Text>
            </View>
            <View style={styles.rideDivider} />
            <Text style={styles.courierPayloadTitle}>Посылка</Text>
            <Text style={styles.courierPayloadText}>{activeCourierOrder.itemDescription || '-'}</Text>
            {activeCourierOrder.packageWeight ? <Text style={styles.courierMeta}>Вес: {activeCourierOrder.packageWeight}</Text> : null}
            {activeCourierOrder.packageSize ? <Text style={styles.courierMeta}>Размер: {activeCourierOrder.packageSize}</Text> : null}
            {activeCourierOrder.comment ? <Text style={styles.courierMeta}>Комментарий: {activeCourierOrder.comment}</Text> : null}
            <View style={styles.priceRowActive}>
              <Text style={styles.priceLabel}>Стоимость доставки</Text>
              <Text style={styles.priceValue}>{Math.round(Number(activeCourierOrder.estimatedPrice || 0))} ₸</Text>
            </View>
          </View>
        ) : null}

          <View style={styles.buttonsRow}>
            {activeRide && ACTIVE_CANCELABLE_STATUSES.includes(activeRide.status) ? (
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelBtnText}>Отменить</Text>
              </TouchableOpacity>
            ) : null}
            {activeCourierOrder && activeCourierOrder.status !== 'DELIVERED' && activeCourierOrder.status !== 'CANCELED' ? (
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelBtnText}>Отменить</Text>
              </TouchableOpacity>
            ) : null}
            {activeRide?.driver && onOpenRideChat ? (
              <TouchableOpacity style={styles.chatBtn} onPress={onOpenRideChat}>
                <Text style={styles.chatBtnText}>Чат с водителем</Text>
                {rideUnreadCount > 0 ? (
                  <View style={styles.chatBadge}>
                    <Text style={styles.chatBadgeText}>{rideUnreadCount > 99 ? '99+' : rideUnreadCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ) : null}
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
};

function getStatusDotColor(status: string) {
  switch (status) {
    case 'COMPLETED':
    case 'DELIVERED':
      return { backgroundColor: '#10B981' };
    case 'CANCELED':
      return { backgroundColor: '#EF4444' };
    case 'IN_PROGRESS':
      return { backgroundColor: '#3B82F6' };
    case 'ON_THE_WAY':
    case 'DRIVER_ASSIGNED':
    case 'DRIVER_ARRIVED':
    case 'TO_PICKUP':
    case 'COURIER_ARRIVED':
    case 'TO_RECIPIENT':
      return { backgroundColor: '#F59E0B' };
    default:
      return { backgroundColor: '#71717A' };
  }
}

function translateStatus(status: string): string {
  const t: Record<string, string> = {
    SEARCHING_DRIVER: 'Ищем водителя',
    DRIVER_ASSIGNED: 'Водитель едет к вам',
    ON_THE_WAY: 'Водитель едет к вам',
    DRIVER_ARRIVED: 'Водитель прибыл',
    IN_PROGRESS: 'Вы в пути',
    COMPLETED: 'Поездка завершена',
    CANCELED: 'Отменена',
  };
  return t[status] || status;
}

function translateCourierStatus(status: string): string {
  const t: Record<string, string> = {
    SEARCHING_COURIER: 'Ищем курьера',
    TO_PICKUP: 'Курьер едет к вам',
    COURIER_ARRIVED: 'Курьер на месте',
    TO_RECIPIENT: 'Курьер едет к получателю',
    DELIVERED: 'Доставлено',
    CANCELED: 'Отменено',
  };
  return t[status] || status;
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
    backgroundColor: '#09090B',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  handle: {
    paddingTop: 10,
  },
  handleIndicator: {
    backgroundColor: '#27272A',
    width: 40,
    height: 4,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  statusTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  etaBadge: {
    alignSelf: 'center',
    backgroundColor: '#18181B',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 16,
  },
  etaLabel: { color: '#A1A1AA', fontSize: 12, textAlign: 'center', marginBottom: 4 },
  etaValue: { color: '#F4F4F5', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  rideCard: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  driverRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  driverName: { color: '#F4F4F5', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  carInfo: { color: '#A1A1AA', fontSize: 14, fontWeight: '500' },
  plateBox: { backgroundColor: '#27272A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  plateText: { color: '#F4F4F5', fontSize: 14, fontWeight: '700', textTransform: 'uppercase' },
  routePointRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  routeDotBlue: { width: 10, height: 10, borderRadius: 5, marginRight: 12, backgroundColor: '#3B82F6' },
  routeDotStop: { width: 10, height: 10, borderRadius: 5, marginRight: 12, backgroundColor: '#F97316' },
  routeDotRed: { width: 10, height: 10, borderRadius: 5, marginRight: 12, backgroundColor: '#EF4444' },
  addressText: { color: '#E4E4E7', fontSize: 15, fontWeight: '500', flex: 1 },
  rideDivider: { height: 1, backgroundColor: '#27272A', marginVertical: 12 },
  priceRowActive: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { color: '#A1A1AA', fontSize: 14, fontWeight: '500' },
  priceValue: { color: '#3B82F6', fontSize: 22, fontWeight: '800' },
  buttonsRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  cancelBtnText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  chatBtn: {
    flex: 2,
    backgroundColor: '#F4F4F5',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
  chatBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  courierPayloadTitle: { color: '#F4F4F5', fontSize: 14, fontWeight: '800', marginBottom: 6 },
  courierPayloadText: { color: '#E4E4E7', fontSize: 15, fontWeight: '600', marginBottom: 6 },
  courierMeta: { color: '#A1A1AA', fontSize: 13, marginBottom: 4 },
});
