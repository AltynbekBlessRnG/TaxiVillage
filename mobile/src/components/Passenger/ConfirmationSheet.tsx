import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomSheet, {
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import type { RideQuote } from '../../screens/Passenger/home/useRideQuote';
import { showAlert } from '../../components/AppAlert';

/** Steps the passenger can nudge the price by, in tenge. */
const PRICE_STEP = 100;

interface Props {
  serviceType?: 'taxi' | 'courier';
  rideQuote?: RideQuote | null;
  fromAddress: string;
  toAddress: string;
  fromLocationPrecision?: 'EXACT' | 'LANDMARK_TEXT';
  toLocationPrecision?: 'EXACT' | 'LANDMARK_TEXT';
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
  isAddStopDisabled?: boolean;
  onRemoveStop?: (index: number) => void;
  itemDescription?: string;
  setItemDescription?: (t: string) => void;
  packageWeight?: string;
  setPackageWeight?: (t: string) => void;
  packageSize?: string;
  setPackageSize?: (t: string) => void;
}

export const ConfirmationSheet: React.FC<Props> = ({
  serviceType = 'taxi',
  rideQuote = null,
  fromAddress,
  toAddress,
  fromLocationPrecision = 'EXACT',
  toLocationPrecision = 'EXACT',
  price,
  setPrice,
  onOrder,
  onEditAddress,
  onSwipeDown,
  loading,
  comment,
  setComment,
  stops,
  onAddStop,
  isAddStopDisabled,
  onRemoveStop,
  itemDescription,
  setItemDescription,
  packageWeight,
  setPackageWeight,
  packageSize,
  setPackageSize,
}) => {
  const [isCommentModalVisible, setCommentModalVisible] = useState(false);
  const [tempComment, setTempComment] = useState(comment);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const snapPoints = useMemo(() => {
    if (isKeyboardVisible) {
      return serviceType === 'courier' ? ['78%'] : ['72%'];
    }

    return serviceType === 'courier' ? ['52%'] : ['44%'];
  }, [isKeyboardVisible, serviceType]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Prefill the suggested price once, and only while the passenger has not
  // typed anything — retyping their number from under them would be worse than
  // showing no suggestion at all.
  const hasPrefilledRef = useRef(false);
  useEffect(() => {
    if (hasPrefilledRef.current || !rideQuote || price) {
      return;
    }
    hasPrefilledRef.current = true;
    setPrice(String(rideQuote.suggestedPrice));
  }, [rideQuote, price, setPrice]);

  const adjustPrice = (delta: number) => {
    const current = parseInt(price, 10) || rideQuote?.suggestedPrice || 0;
    const floor = rideQuote?.minPrice ?? PRICE_STEP;
    setPrice(String(Math.max(floor, current + delta)));
  };

  const handleSaveComment = () => {
    setComment(tempComment);
    setCommentModalVisible(false);
  };

  const handleStopPress = (index: number, address: string) => {
    showAlert('Удалить заезд?', address, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => onRemoveStop?.(index) },
    ]);
  };

  return (
    <>
      <View style={styles.fullOverlay} pointerEvents="box-none">
        <BottomSheet
          index={0}
          snapPoints={snapPoints}
          enablePanDownToClose
          onClose={onSwipeDown}
          handleIndicatorStyle={styles.handle}
          backgroundStyle={styles.sheetBackground}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          enableDynamicSizing={false}
        >
          <BottomSheetView style={styles.sheetContent}>
            <View style={styles.addressBox}>
              <View style={styles.routeRow}>
                <View style={styles.dotBlueSmall} />
                <TouchableOpacity style={styles.addressContainer} onPress={onEditAddress}>
                  <Text style={styles.routeLabel}>Откуда</Text>
                  <Text style={styles.addressText} numberOfLines={1}>
                    {fromAddress}
                  </Text>
                  {fromLocationPrecision === 'LANDMARK_TEXT' ? (
                    <View style={styles.precisionBadge}>
                      <Text style={styles.precisionBadgeText}>Ориентир</Text>
                    </View>
                  ) : null}
                  {comment ? (
                    <Text style={styles.commentText} numberOfLines={1}>
                      {comment}
                    </Text>
                  ) : null}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sideActionBtn}
                  onPress={() => {
                    setTempComment(comment);
                    setCommentModalVisible(true);
                  }}
                >
                  <Text style={styles.sideActionText}>Комментарий</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              <View style={styles.routeRow}>
                <View style={styles.squareRedSmall} />
                <TouchableOpacity style={styles.addressContainer} onPress={onEditAddress}>
                  <Text style={styles.routeLabel}>Куда</Text>
                  <Text style={styles.addressText} numberOfLines={1}>
                    {toAddress || (serviceType === 'courier' ? 'Куда доставить?' : 'Куда едем?')}
                  </Text>
                  {toLocationPrecision === 'LANDMARK_TEXT' ? (
                    <View style={styles.precisionBadge}>
                      <Text style={styles.precisionBadgeText}>Ориентир</Text>
                    </View>
                  ) : null}
                  {serviceType === 'taxi' &&
                    stops.map((stop, index) => (
                      <View key={`${stop.address}-${index}`} style={styles.stopRow}>
                        <Text style={styles.stopsText} numberOfLines={1}>
                          Заезд: {stop.address}
                        </Text>
                        <TouchableOpacity
                          style={styles.stopRemoveBtn}
                          onPress={() => handleStopPress(index, stop.address)}
                          hitSlop={10}
                        >
                          <Text style={styles.stopRemoveText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                </TouchableOpacity>

                {serviceType === 'taxi' && stops.length < 3 ? (
                  <TouchableOpacity
                    style={[styles.sideActionBtn, styles.plusBtn, isAddStopDisabled && styles.actionBtnDisabled]}
                    onPress={onAddStop}
                    disabled={isAddStopDisabled}
                  >
                    <Text style={styles.plusText}>+</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {serviceType === 'courier' ? (
              <View style={styles.courierFields}>
                <BottomSheetTextInput
                  style={styles.courierInput}
                  placeholder="Что доставить?"
                  placeholderTextColor="#71717A"
                  value={itemDescription}
                  onChangeText={(text) => setItemDescription?.(text)}
                />
                <View style={styles.courierRow}>
                  <BottomSheetTextInput
                    style={[styles.courierInput, styles.courierInputHalf]}
                    placeholder="Вес"
                    placeholderTextColor="#71717A"
                    value={packageWeight}
                    onChangeText={(text) => setPackageWeight?.(text)}
                  />
                  <BottomSheetTextInput
                    style={[styles.courierInput, styles.courierInputHalf]}
                    placeholder="Размер"
                    placeholderTextColor="#71717A"
                    value={packageSize}
                    onChangeText={(text) => setPackageSize?.(text)}
                  />
                </View>
              </View>
            ) : null}

            <View style={styles.priceCard}>
              <View style={styles.priceRow}>
                <Text style={styles.currencyIcon}>₸</Text>
                <BottomSheetTextInput
                  style={styles.priceInput}
                  placeholder={serviceType === 'courier' ? 'Цена доставки' : 'Ваша цена'}
                  placeholderTextColor="#71717A"
                  keyboardType="numeric"
                  value={price}
                  onChangeText={(text) => setPrice(text.replace(/\D/g, ''))}
                />
                {serviceType === 'taxi' ? (
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => adjustPrice(-PRICE_STEP)}
                    >
                      <Text style={styles.stepperText}>−</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => adjustPrice(PRICE_STEP)}
                    >
                      <Text style={styles.stepperText}>+</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>

              {rideQuote ? (
                <Text style={styles.priceHint}>
                  {rideQuote.isRoughEstimate
                    ? `Примерно ${rideQuote.suggestedPrice} ₸`
                    : `Обычная цена ${rideQuote.suggestedPrice} ₸ · ${rideQuote.distanceKm} км`}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity style={styles.finalBtn} onPress={onOrder} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#09090B" />
              ) : (
                <Text style={styles.finalBtnText}>
                  {serviceType === 'courier' ? 'Подтвердить доставку' : 'Подтвердить поездку'}
                </Text>
              )}
            </TouchableOpacity>
          </BottomSheetView>
        </BottomSheet>
      </View>

      <Modal visible={isCommentModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Комментарий водителю</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Например: черный забор, подъезд 3"
              placeholderTextColor="#71717A"
              value={tempComment}
              onChangeText={setTempComment}
              multiline
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setCommentModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={handleSaveComment}>
                <Text style={styles.modalBtnSaveText}>Сохранить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 600,
    pointerEvents: 'box-none',
  },
  sheetBackground: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  handle: {
    backgroundColor: '#27272A',
    width: 42,
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  addressBox: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10 },
  routeLabel: { color: '#71717A', fontSize: 10, fontWeight: '700', marginBottom: 2, textTransform: 'uppercase' },
  addressContainer: { flex: 1 },
  dotBlueSmall: { width: 8, height: 8, backgroundColor: '#3B82F6', borderRadius: 4, marginRight: 15 },
  squareRedSmall: { width: 8, height: 8, backgroundColor: '#EF4444', marginRight: 15 },
  addressText: { color: '#F4F4F5', fontSize: 16, fontWeight: '600' },
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
  commentText: { color: '#71717A', fontSize: 11, marginTop: 3 },
  stopRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  stopsText: { color: '#71717A', fontSize: 11, flex: 1 },
  stopRemoveBtn: { paddingHorizontal: 6 },
  stopRemoveText: { color: '#71717A', fontSize: 12, fontWeight: '800' },
  actionBtnDisabled: { opacity: 0.4 },
  sideActionBtn: {
    backgroundColor: '#27272A',
    borderWidth: 1,
    borderColor: '#3F3F46',
    minWidth: 72,
    height: 40,
    borderRadius: 14,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  sideActionText: { color: '#F4F4F5', fontSize: 12, fontWeight: '800' },
  plusBtn: { minWidth: 40, width: 40 },
  plusText: { color: '#F4F4F5', fontSize: 20, fontWeight: '700', marginTop: -1 },
  stepperRow: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  stepperBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#27272A',
    borderWidth: 1,
    borderColor: '#3F3F46',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: { color: '#F4F4F5', fontSize: 19, fontWeight: '800', marginTop: -2 },
  priceHint: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 2,
  },
  divider: { height: 1, backgroundColor: '#27272A', marginHorizontal: 10 },
  courierFields: { marginTop: 14, gap: 10 },
  courierRow: { flexDirection: 'row', gap: 10 },
  courierInput: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#fff',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  courierInputHalf: { flex: 1 },
  priceCard: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  currencyIcon: { color: '#F4F4F5', fontSize: 20, fontWeight: '900', marginRight: 10 },
  priceInput: { flex: 1, color: '#F4F4F5', fontSize: 22, fontWeight: '700', paddingVertical: 0 },
  finalBtn: {
    backgroundColor: '#F4F4F5',
    height: 54,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  finalBtnText: { color: '#09090B', fontSize: 16, fontWeight: '900' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#18181B',
    width: '100%',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 15 },
  modalInput: {
    backgroundColor: '#09090B',
    color: '#fff',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 20,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtnCancel: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 10 },
  modalBtnCancelText: { color: '#71717A', fontSize: 16, fontWeight: '600' },
  modalBtnSave: { backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  modalBtnSaveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
