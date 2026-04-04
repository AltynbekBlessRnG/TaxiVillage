import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

interface Props {
  visible: boolean;
  fromAddress?: string;
  toAddress?: string;
  comment?: string;
  stops?: Array<{ address: string }>;
  price?: string;
  onClose: () => void;
}

export const SearchingDetailsSheet: React.FC<Props> = ({
  visible,
  fromAddress = '',
  toAddress = '',
  comment = '',
  stops = [],
  price = '',
  onClose,
}) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['42%'], []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    requestAnimationFrame(() => {
      bottomSheetRef.current?.snapToIndex(0);
    });
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.fullOverlay} pointerEvents="box-none">
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose
        enableDynamicSizing={false}
        onClose={onClose}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        backgroundStyle={styles.background}
        style={styles.sheetShadow}
      >
        <BottomSheetView style={styles.content}>
          <Text style={styles.title}>Детали заказа</Text>

          <View style={styles.routeCard}>
            <View style={styles.routeRow}>
              <View style={styles.dotBlue} />
              <View style={styles.routeTextWrap}>
                <Text style={styles.routeLabel}>Откуда</Text>
                <Text style={styles.routeText} numberOfLines={2}>
                  {comment ? `${fromAddress}, ${comment}` : fromAddress}
                </Text>
              </View>
            </View>

            {stops.map((stop, index) => (
              <View key={`${stop.address}-${index}`} style={styles.routeRow}>
                <View style={styles.dotStop} />
                <View style={styles.routeTextWrap}>
                  <Text style={styles.routeLabel}>{`Заезд ${index + 1}`}</Text>
                  <Text style={styles.routeText} numberOfLines={1}>
                    {stop.address}
                  </Text>
                </View>
              </View>
            ))}

            <View style={styles.routeRow}>
              <View style={styles.dotRed} />
              <View style={styles.routeTextWrap}>
                <Text style={styles.routeLabel}>Куда</Text>
                <Text style={styles.routeText} numberOfLines={2}>
                  {toAddress}
                </Text>
              </View>
            </View>

            <View style={styles.routeDivider} />

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Предложенная цена</Text>
              <Text style={styles.priceValue}>{price || '0'} ₸</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Закрыть</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 760,
    pointerEvents: 'box-none',
  },
  sheetShadow: {
    zIndex: 760,
    elevation: 24,
  },
  background: {
    backgroundColor: '#09090B',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  handle: {
    paddingTop: 10,
  },
  handleIndicator: {
    backgroundColor: '#3F3F46',
    width: 40,
    height: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 4,
  },
  title: { color: '#F4F4F5', fontSize: 18, fontWeight: '800', marginBottom: 14, textAlign: 'center' },
  routeCard: {
    backgroundColor: '#18181B',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 14,
  },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  routeTextWrap: { flex: 1 },
  routeLabel: { color: '#A1A1AA', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  routeText: { color: '#F4F4F5', fontSize: 14, fontWeight: '500' },
  dotBlue: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6', marginTop: 4, marginRight: 12 },
  dotStop: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F97316', marginTop: 4, marginRight: 12 },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', marginTop: 4, marginRight: 12 },
  routeDivider: { height: 1, backgroundColor: '#27272A', marginTop: 4, marginBottom: 10 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
  priceValue: { color: '#F4F4F5', fontSize: 17, fontWeight: '800' },
  closeBtn: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: '#F4F4F5', fontSize: 15, fontWeight: '800' },
});
