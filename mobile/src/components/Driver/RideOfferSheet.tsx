import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';

const { height } = Dimensions.get('window');

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
}

interface Props {
  offer: RideOffer | null;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onCallPassenger?: (phone: string) => void;
}

export const RideOfferSheet: React.FC<Props> = ({ offer, onAccept, onReject, onCallPassenger }) => {
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (offer) {
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: height, duration: 300, useNativeDriver: true }).start();
    }
  }, [offer]);

  if (!offer) return null;

  const price = offer.estimatedPrice ? Math.round(offer.estimatedPrice) : '—';

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.workspace}>
        <View style={styles.header}>
          <Text style={styles.newOrderText}>Новый заказ</Text>
          <Text style={styles.priceText}>{price} ₸</Text>
        </View>

        {offer.hasRoute === false && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>⚠️ Точки нет на карте. Ориентируйтесь по тексту.</Text>
          </View>
        )}

        <View style={styles.routeBox}>
          <View style={styles.routePoint}>
            <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
            <View style={styles.addressWrap}>
              <Text style={styles.addressText} numberOfLines={1}>{offer.fromAddress}</Text>
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
              <Text style={styles.addressText} numberOfLines={1}>Заезд: {stop.address}</Text>
            </View>
          ))}

          <View style={styles.routePoint}>
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            <View style={styles.addressWrap}>
              <Text style={styles.addressText} numberOfLines={1}>{offer.toAddress}</Text>
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
            <Text style={styles.commentText}>💬 {offer.comment}</Text>
          </View>
        ) : null}

        {offer.passenger?.user?.phone ? (
          <TouchableOpacity style={styles.callBtn} onPress={() => onCallPassenger?.(offer.passenger!.user!.phone!)}>
            <Text style={styles.callBtnText}>Позвонить клиенту</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.buttonsRow}>
          <TouchableOpacity style={styles.rejectBtn} onPress={() => onReject(offer.id)}>
            <Text style={styles.rejectBtnText}>Пропустить</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={() => onAccept(offer.id)}>
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
    paddingTop: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    borderTopWidth: 1, 
    borderColor: '#27272A' 
  },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  newOrderText: { color: '#F4F4F5', fontSize: 17, fontWeight: '800' },
  priceText: { color: '#3B82F6', fontSize: 24, fontWeight: '900' },
  warningBox: { backgroundColor: '#1C1C1E', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#F59E0B', marginBottom: 12 },
  warningText: { color: '#F59E0B', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  routeBox: { backgroundColor: '#18181B', padding: 14, borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: '#27272A' },
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
  commentBox: { marginBottom: 14, paddingHorizontal: 2 },
  commentText: { color: '#71717A', fontSize: 13, fontStyle: 'italic' },
  callBtn: {
    backgroundColor: '#18181B',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 14,
  },
  callBtnText: { color: '#F4F4F5', fontSize: 15, fontWeight: '800' },
  buttonsRow: { flexDirection: 'row', gap: 12 },
  rejectBtn: { flex: 1, backgroundColor: '#1C1C1E', paddingVertical: 15, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#27272A' },
  rejectBtnText: { color: '#A1A1AA', fontSize: 16, fontWeight: '700' },
  acceptBtn: { flex: 2, backgroundColor: '#F4F4F5', paddingVertical: 15, borderRadius: 16, alignItems: 'center' },
  acceptBtnText: { color: '#000', fontSize: 18, fontWeight: '900' },
});
