import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../theme/colors';

type Service = 'Такси' | 'Курьер' | 'Еда' | 'Межгород';

const SERVICES: Service[] = ['Такси', 'Курьер', 'Еда', 'Межгород'];

/** Emoji render at the vendor's whim and read as stickers next to the UI. */
const SERVICE_ICONS: Record<Service, keyof typeof Ionicons.glyphMap> = {
  'Такси': 'car',
  'Курьер': 'cube',
  'Еда': 'fast-food',
  'Межгород': 'trail-sign',
};

interface Props {
  fromAddress: string;
  toAddress: string;
  activeService: Service;
  activeRideId: string | null;
  activeRide: any;
  activeCourierOrderId: string | null;
  onOpenMenu: () => void;
  onOpenSearch: (field: 'from' | 'to') => void;
  onRecenter: () => void;
  onOpenActiveRide: () => void;
  onOpenActiveCourier: () => void;
  onSelectService: (service: Service) => void;
  unreadNotificationsCount: number;
}

export const PassengerIdleOverlay: React.FC<Props> = ({
  fromAddress,
  toAddress,
  activeService,
  activeRideId,
  activeRide,
  activeCourierOrderId,
  onOpenMenu,
  onOpenSearch,
  onRecenter,
  onOpenActiveRide,
  onOpenActiveCourier,
  onSelectService,
  unreadNotificationsCount,
}) => {
  // Notches, punch holes and the home indicator all live in this overlay's
  // space, so every anchored element is offset by the real inset.
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, 12);
  const bottomInset = Math.max(insets.bottom, 16);

  return (
    <View style={styles.uiOverlay} pointerEvents="box-none">
      <TouchableOpacity
        style={[styles.burgerBtn, { top: topInset + 8 }]}
        onPress={onOpenMenu}
        accessibilityRole="button"
        accessibilityLabel={
          unreadNotificationsCount > 0
            ? `Меню, непрочитанных уведомлений: ${unreadNotificationsCount}`
            : 'Меню'
        }
      >
        <Ionicons name="menu" size={24} color={colors.text} />
        {unreadNotificationsCount > 0 ? (
          <View style={styles.burgerBadge}>
            <Text style={styles.burgerBadgeText}>
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={[styles.ashenSearchCard, { marginTop: topInset + 66 }]}>
        <TouchableOpacity style={styles.ashenRow} onPress={() => onOpenSearch('from')}>
          <View style={styles.dotBlue} />
          <Text style={styles.ashenInputText} numberOfLines={1}>
            {fromAddress}
          </Text>
        </TouchableOpacity>

        <View style={styles.zincDivider} />

        <TouchableOpacity style={styles.ashenRow} onPress={() => onOpenSearch('to')}>
          <View style={styles.squareRed} />
          <Text
            style={toAddress ? styles.ashenInputText : styles.placeholderZinc}
            numberOfLines={1}
          >
            {toAddress || (activeService === 'Курьер' ? 'Куда доставить?' : 'Куда едем?')}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.recenterBtn, { bottom: bottomInset + 190 }]}
        onPress={onRecenter}
        accessibilityRole="button"
        accessibilityLabel="Показать моё местоположение"
      >
        <View style={styles.recenterOuter}>
          <View style={styles.recenterInner} />
        </View>
      </TouchableOpacity>

      {activeRideId && !activeRide ? (
        <TouchableOpacity
          style={[styles.activeRideBanner, { bottom: bottomInset + 120 }]}
          onPress={onOpenActiveRide}
          accessibilityRole="button"
          accessibilityLabel="У вас есть активная поездка. Открыть"
        >
          <View style={styles.dotGreen} />
          <Text style={styles.activeRideText}>У вас есть активная поездка</Text>
          <Ionicons name="chevron-forward" size={24} color={colors.white} style={styles.activeRideArrow} />
        </TouchableOpacity>
      ) : null}

      {!activeRideId && activeCourierOrderId ? (
        <TouchableOpacity
          style={[
            styles.activeRideBanner,
            styles.activeCourierBanner,
            { bottom: bottomInset + 120 },
          ]}
          onPress={onOpenActiveCourier}
          accessibilityRole="button"
          accessibilityLabel="У вас есть активная доставка. Открыть"
        >
          <View style={styles.dotGreen} />
          <Text style={styles.activeRideText}>У вас есть активная доставка</Text>
          <Ionicons name="chevron-forward" size={24} color={colors.white} style={styles.activeRideArrow} />
        </TouchableOpacity>
      ) : null}

      <View style={[styles.bottomAshenBar, { bottom: bottomInset + 12 }]}>
        {SERVICES.map((service) => (
          <TouchableOpacity
            key={service}
            style={styles.servicePill}
            onPress={() => onSelectService(service)}
            accessibilityRole="button"
            accessibilityLabel={service}
            accessibilityState={{ selected: activeService === service }}
          >
            <View
              style={[
                styles.serviceCircle,
                activeService === service && styles.serviceCircleActive,
              ]}
            >
              <Ionicons
                name={SERVICE_ICONS[service]}
                size={24}
                color={activeService === service ? colors.bg : colors.textMuted}
              />
            </View>
            <Text
              style={[styles.serviceLabel, activeService === service && styles.serviceLabelActive]}
            >
              {service}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  uiOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  burgerBtn: {
    position: 'absolute',
    left: 20,
    width: 46,
    height: 46,
    backgroundColor: colors.surface,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 100,
  },
  burgerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.dangerStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burgerBadgeText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  ashenSearchCard: {
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 15,
  },
  ashenRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  ashenInputText: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '500' },
  placeholderZinc: { color: colors.textTertiary, fontSize: 16, flex: 1 },
  zincDivider: { height: 1, backgroundColor: colors.surfaceRaised, marginVertical: 4, marginLeft: 28 },
  dotBlue: { width: 8, height: 8, backgroundColor: colors.info, borderRadius: 4, marginRight: 15 },
  squareRed: { width: 8, height: 8, backgroundColor: colors.danger, marginRight: 15 },
  recenterBtn: {
    position: 'absolute',
    right: 20,
    width: 50,
    height: 50,
    backgroundColor: colors.surface,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  recenterOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recenterInner: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.surfaceInverse,
  },
  activeRideBanner: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: colors.success,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeCourierBanner: {
    backgroundColor: colors.warning,
  },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.white, marginRight: 12 },
  activeRideText: { color: colors.white, fontSize: 16, fontWeight: '700', flex: 1 },
  activeRideArrow: { color: colors.white, fontSize: 24, fontWeight: '300' },
  bottomAshenBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  servicePill: { alignItems: 'center', width: 72 },
  serviceCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(24,24,27,0.92)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  serviceCircleActive: {
    backgroundColor: colors.surfaceInverse,
    borderColor: colors.text,
  },
  serviceLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  serviceLabelActive: { color: colors.text },
});
