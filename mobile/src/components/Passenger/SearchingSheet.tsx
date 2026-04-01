import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

const { width } = Dimensions.get('window');

interface Props {
  onCancel: () => void;
  title?: string;
  cancelLabel?: string;
  fromAddress?: string;
  toAddress?: string;
  comment?: string;
  stops?: Array<{ address: string }>;
  price?: string;
}

export const SearchingSheet: React.FC<Props> = ({
  onCancel,
  title = 'Ищем машину...',
  cancelLabel = 'Отменить\nпоездку',
  fromAddress = '',
  toAddress = '',
  comment = '',
  stops = [],
  price = '',
}) => {
  const [seconds, setSeconds] = useState(0);
  const animValue = useRef(new Animated.Value(0)).current;
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['30%'], []);

  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);

    const animation = Animated.loop(
      Animated.timing(animValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    animation.start();
    return () => {
      clearInterval(interval);
      animation.stop();
      animValue.setValue(0);
    };
  }, [animValue]);

  useEffect(() => {
    requestAnimationFrame(() => {
      bottomSheetRef.current?.snapToIndex(0);
    });
  }, []);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 0.5, width],
  });

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
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.timer}>{formatTime(seconds)}</Text>
          </View>

          <View style={styles.progressBarBg}>
            <Animated.View style={[styles.progressBarFill, { transform: [{ translateX }] }]} />
          </View>

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

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.circleBtnContainer} onPress={onCancel}>
              <View style={styles.circleBtn}>
                <Text style={styles.btnIcon}>✕</Text>
              </View>
              <Text style={styles.btnLabel}>{cancelLabel}</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
};

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
    backgroundColor: '#121212',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  handle: {
    paddingTop: 10,
  },
  handleIndicator: {
    backgroundColor: '#3F3F46',
    width: 42,
    height: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', flex: 1 },
  timer: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 12 },
  progressBarBg: {
    height: 3,
    backgroundColor: '#27272A',
    width: '100%',
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    width: '40%',
    position: 'absolute',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 8,
  },
  circleBtnContainer: { alignItems: 'center' },
  circleBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  btnIcon: { color: '#fff', fontSize: 20 },
  btnLabel: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  routeCard: {
    backgroundColor: '#18181B',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 18,
  },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  routeTextWrap: { flex: 1 },
  routeLabel: { color: '#A1A1AA', fontSize: 12, fontWeight: '700', marginBottom: 2 },
  routeText: { color: '#F4F4F5', fontSize: 14, fontWeight: '500' },
  dotBlue: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6', marginTop: 4, marginRight: 12 },
  dotStop: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F97316', marginTop: 4, marginRight: 12 },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', marginTop: 4, marginRight: 12 },
  routeDivider: { height: 1, backgroundColor: '#27272A', marginTop: 4, marginBottom: 10 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
  priceValue: { color: '#F4F4F5', fontSize: 18, fontWeight: '800' },
});
