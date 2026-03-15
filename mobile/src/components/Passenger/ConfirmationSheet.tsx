import React, { useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, 
  PanResponder, KeyboardAvoidingView, Platform, ActivityIndicator 
} from 'react-native';

interface Props {
  translateY: Animated.Value;
  fromAddress: string;
  toAddress: string;
  price: string;
  setPrice: (t: string) => void;
  onOrder: () => void;
  onEditAddress: () => void;
  onSwipeDown: () => void;
  loading: boolean;
  comment: string;
  setComment: (t: string) => void;
  stops: Array<{ address: string; lat: number; lng: number }>;
  onAddStop: () => void;
  onEditComment: () => void;
}

export const ConfirmationSheet: React.FC<Props> = ({
  translateY, fromAddress, toAddress, price, setPrice, onOrder, onEditAddress, onSwipeDown, loading, comment, setComment, stops, onAddStop, onEditComment
}) => {
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 10,
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 150) onSwipeDown();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  return (
    <Animated.View style={[styles.fullOverlay, { transform: [{ translateY }] }]} pointerEvents="box-none">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none">
        <View style={styles.expoMatteSheet}>
          <View {...panResponder.panHandlers} style={styles.swipeArea}><View style={styles.expoHandle} /></View>
          
          <View style={styles.addressBox}>
            <TouchableOpacity style={styles.expoRow} onPress={onEditAddress}>
              <View style={styles.dotBlueSmall} />
              <View style={styles.addressContainer}>
                <Text style={styles.expoAddressText} numberOfLines={1}>{fromAddress}</Text>
                {comment && <Text style={styles.commentText}>{comment}</Text>}
              </View>
              <TouchableOpacity style={styles.expoActionBtn} onPress={onEditComment}>
                <Text style={styles.expoActionText}>Комментарий</Text>
              </TouchableOpacity>
            </TouchableOpacity>
            <View style={styles.zincDivider} />
            <TouchableOpacity style={styles.expoRow} onPress={onEditAddress}>
              <View style={styles.squareRedSmall} />
              <View style={styles.addressContainer}>
                <Text style={styles.expoAddressText} numberOfLines={1}>{toAddress}</Text>
                {stops.length > 0 && (
                  <Text style={styles.stopsText}>
                    {stops.map(stop => stop.address).join(', ')}
                  </Text>
                )}
              </View>
              <TouchableOpacity style={styles.expoActionBtn} onPress={onAddStop}>
                <Text style={styles.expoActionText}>＋</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.currencyIcon}>₸</Text>
            <TextInput 
              style={styles.priceInput} 
              placeholder="Ваша цена" 
              placeholderTextColor="#71717A" 
              keyboardType="numeric" 
              value={price} 
              onChangeText={setPrice} 
            />
          </View>

          <TouchableOpacity style={styles.expoFinalBtn} onPress={onOrder} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.expoFinalBtnText}>Заказать</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fullOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 600, justifyContent: 'flex-end' },
  expoMatteSheet: { backgroundColor: '#121212', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 50, borderWidth: 1, borderColor: '#27272A' },
  swipeArea: { width: '100%', alignItems: 'center', paddingBottom: 20 },
  expoHandle: { width: 40, height: 4, backgroundColor: '#27272A', borderRadius: 2 },
  addressBox: { backgroundColor: '#18181B', borderRadius: 20, padding: 10, borderWidth: 1, borderColor: '#27272A' },
  expoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10 },
  addressContainer: { flex: 1 },
  dotBlueSmall: { width: 8, height: 8, backgroundColor: '#3B82F6', borderRadius: 4, marginRight: 15 },
  squareRedSmall: { width: 8, height: 8, backgroundColor: '#EF4444', marginRight: 15 },
  expoAddressText: { color: '#E4E4E7', fontSize: 15 },
  commentText: { color: '#71717A', fontSize: 12, marginTop: 2 },
  stopsText: { color: '#71717A', fontSize: 12, marginTop: 2 },
  expoActionBtn: { backgroundColor: '#1C1C1E', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginLeft: 10 },
  expoActionText: { color: '#A1A1AA', fontSize: 12, fontWeight: '600' },
  zincDivider: { height: 1, backgroundColor: '#27272A', marginHorizontal: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B', height: 64, borderRadius: 20, marginTop: 20, paddingHorizontal: 20, borderWidth: 1, borderColor: '#27272A' },
  currencyIcon: { color: '#3B82F6', fontSize: 22, fontWeight: '900', marginRight: 15 },
  priceInput: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '700' },
  expoFinalBtn: { backgroundColor: '#F4F4F5', height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 25 },
  expoFinalBtnText: { color: '#000', fontSize: 18, fontWeight: '900' },
});