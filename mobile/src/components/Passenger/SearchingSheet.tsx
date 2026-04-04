import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

const { width } = Dimensions.get('window');

interface Props {
  onCancel: () => void;
  onShowDetails: () => void;
  title?: string;
  cancelLabel?: string;
}

export const SearchingSheet: React.FC<Props> = ({
  onCancel,
  onShowDetails,
  title = 'Ищем машину...',
  cancelLabel = 'Отменить\nпоездку',
}) => {
  const [seconds, setSeconds] = useState(0);
  const animValue = useRef(new Animated.Value(0)).current;
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['22%'], []);

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

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.circleBtnContainer} onPress={onCancel}>
              <View style={styles.circleBtn}>
                <Text style={styles.btnIcon}>✕</Text>
              </View>
              <Text style={styles.btnLabel}>Отменить заказ</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.circleBtnContainer} onPress={onShowDetails}>
              <View style={styles.circleBtn}>
                <Text style={styles.btnIcon}>☰</Text>
              </View>
              <Text style={styles.btnLabel}>Детали</Text>
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
    paddingBottom: 22,
    paddingTop: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 },
  timer: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 12 },
  progressBarBg: {
    height: 3,
    backgroundColor: '#27272A',
    width: '100%',
    marginBottom: 16,
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
    gap: 40,
    marginBottom: 0,
  },
  circleBtnContainer: { alignItems: 'center' },
  circleBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  btnIcon: { color: '#fff', fontSize: 18 },
  btnLabel: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
});
