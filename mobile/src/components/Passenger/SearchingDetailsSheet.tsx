import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { colors } from '../../theme/colors';

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
    backgroundColor: colors.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    paddingTop: 10,
  },
  handleIndicator: {
    backgroundColor: colors.borderStrong,
    width: 40,
    height: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 4,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 14, textAlign: 'center' },
  routeCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  routeTextWrap: { flex: 1 },
  routeLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  routeText: { color: colors.text, fontSize: 14, fontWeight: '500' },
  dotBlue: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.info, marginTop: 4, marginRight: 12 },
  dotStop: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.foodStrong, marginTop: 4, marginRight: 12 },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger, marginTop: 4, marginRight: 12 },
  routeDivider: { height: 1, backgroundColor: colors.surfaceRaised, marginTop: 4, marginBottom: 10 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  priceValue: { color: colors.text, fontSize: 17, fontWeight: '800' },
  closeBtn: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: colors.text, fontSize: 15, fontWeight: '800' },
});
