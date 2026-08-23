import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');

/** Used when the server does not say how long the offer stands. */
const DEFAULT_OFFER_SECONDS = 30;

interface RideOffer {
  id: string;
  fromAddress: string;
  toAddress: string;
  comment?: string;
  stops?: Array<{ address: string }>;
  estimatedPrice?: number;
  hasRoute?: boolean;
  pickupLocationPrecision?: 'EXACT' | 'LANDMARK_TEXT';
  dropoffLocationPrecision?: 'EXACT' | 'LANDMARK_TEXT';
  passenger?: { user?: { phone?: string | null } | null } | null;
  pickupDistanceKm?: number;
  pickupEtaMinutes?: number;
  offerExpiresInSeconds?: number;
}

interface Props {
  offer: RideOffer | null;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  variant?: 'taxi' | 'courier';
}

export const RideOfferSheet: React.FC<Props> = ({
  offer,
  onAccept,
  onReject,
  variant = 'taxi',
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(height)).current;
  const totalSeconds = offer?.offerExpiresInSeconds ?? DEFAULT_OFFER_SECONDS;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const offerId = offer?.id ?? null;

  useEffect(() => {
    if (offer) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, { toValue: height, duration: 300, useNativeDriver: true }).start();
    }
  }, [offer, slideAnim]);

  // The server moves the offer to the next driver on its own timer; this just
  // shows the driver how much of it is left instead of letting the card vanish.
  useEffect(() => {
    if (!offerId) {
      return;
    }

    setSecondsLeft(totalSeconds);
    const interval = setInterval(() => {
      setSecondsLeft((value) => (value > 0 ? value - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [offerId, totalSeconds]);

  if (!offer) return null;

  const price = offer.estimatedPrice ? Math.round(offer.estimatedPrice) : '—';
  const accentColor = variant === 'courier' ? '#F59E0B' : '#3B82F6';
  const progress = Math.max(0, Math.min(1, secondsLeft / totalSeconds));
  const urgent = secondsLeft <= 10;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={[styles.workspace, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.handleLine} />
        <View style={styles.header}>
          <Text style={styles.newOrderText}>Новый заказ</Text>
          <Text style={[styles.priceText, { color: accentColor }]}>{price} ₸</Text>
        </View>

        <View style={styles.timerRow}>
          <View style={styles.timerTrack}>
            <View
              style={[
                styles.timerFill,
                { width: `${progress * 100}%`, backgroundColor: urgent ? '#EF4444' : accentColor },
              ]}
            />
          </View>
          <Text style={[styles.timerText, urgent && styles.timerTextUrgent]}>{secondsLeft} с</Text>
        </View>

        {offer.pickupDistanceKm !== undefined ? (
          <View style={styles.pickupRow}>
            <Text style={styles.pickupLabel}>До подачи</Text>
            <Text style={styles.pickupValue}>
              {offer.pickupDistanceKm} км
              {offer.pickupEtaMinutes ? ` · ${offer.pickupEtaMinutes} мин` : ''}
            </Text>
          </View>
        ) : null}

        {offer.hasRoute === false && (
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={16} color="#F59E0B" />
            <Text style={styles.warningText}>Точки нет на карте. Ориентируйтесь по тексту.</Text>
          </View>
        )}

        <View style={styles.routeBox}>
          <View style={styles.routePoint}>
            <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
            <View style={styles.addressWrap}>
              <Text style={styles.addressText} numberOfLines={1}>
                {offer.fromAddress}
              </Text>
              {offer.pickupLocationPrecision === 'LANDMARK_TEXT' ? (
                <View style={styles.precisionBadge}>
                  <Text style={styles.precisionBadgeText}>Ориентир</Text>
                </View>
              ) : null}
            </View>
          </View>

          {offer.stops?.map((stop, idx) => (
            <View key={idx} style={styles.routePoint}>
              <View style={[styles.dot, { backgroundColor: '#F97316' }]} />
              <Text style={styles.addressText} numberOfLines={1}>
                Заезд: {stop.address}
              </Text>
            </View>
          ))}

          <View style={styles.routePoint}>
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            <View style={styles.addressWrap}>
              <Text style={styles.addressText} numberOfLines={1}>
                {offer.toAddress}
              </Text>
              {offer.dropoffLocationPrecision === 'LANDMARK_TEXT' ? (
                <View style={styles.precisionBadge}>
                  <Text style={styles.precisionBadgeText}>Ориентир</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {offer.comment ? (
          <View style={styles.commentBox}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color="#71717A" />
            <Text style={styles.commentText}>{offer.comment}</Text>
          </View>
        ) : null}

        <View style={styles.buttonsRow}>
          <TouchableOpacity style={styles.rejectBtn} onPress={() => onReject(offer.id)}>
            <Text style={styles.rejectBtnText}>Пропустить</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: accentColor }]}
            onPress={() => onAccept(offer.id)}
          >
            <Text style={styles.acceptBtnText}>Принять</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // Прибиваем к низу
  container: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000 },

  // Монолитная панель
  workspace: {
    backgroundColor: '#121212',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#27272A',
  },
  handleLine: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#3A3A40',
    marginBottom: 12,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  newOrderText: { color: '#F4F4F5', fontSize: 17, fontWeight: '800' },
  priceText: { color: '#3B82F6', fontSize: 24, fontWeight: '900' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  timerTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#27272A',
    overflow: 'hidden',
  },
  timerFill: { height: '100%', borderRadius: 999 },
  timerText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '800',
    minWidth: 44,
    textAlign: 'right',
  },
  timerTextUrgent: { color: '#EF4444' },
  pickupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  pickupLabel: { color: '#71717A', fontSize: 13, fontWeight: '700' },
  pickupValue: { color: '#F4F4F5', fontSize: 16, fontWeight: '900' },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1C1C1E',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginBottom: 12,
  },
  warningText: { color: '#F59E0B', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  routeBox: {
    backgroundColor: '#18181B',
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  routePoint: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  addressWrap: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 15 },
  addressText: { color: '#E4E4E7', fontSize: 14, fontWeight: '500' },
  precisionBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  precisionBadgeText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  commentBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, paddingHorizontal: 2 },
  commentText: { color: '#71717A', fontSize: 13, fontStyle: 'italic', flexShrink: 1 },
  buttonsRow: { flexDirection: 'row', gap: 12 },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#18181B',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  rejectBtnText: { color: '#A1A1AA', fontSize: 15, fontWeight: '800' },
  acceptBtn: {
    flex: 3,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: { color: '#04131A', fontSize: 19, fontWeight: '900' },
});
