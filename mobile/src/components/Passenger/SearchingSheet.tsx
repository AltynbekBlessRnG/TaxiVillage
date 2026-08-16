import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

const { width } = Dimensions.get('window');

/** How long to wait before offering to raise the price, in seconds. */
const RAISE_PROMPT_AFTER = 40;
const RAISE_STEP = 200;

interface Props {
  onCancel: () => void;
  onShowDetails: () => void;
  title?: string;
  cancelLabel?: string;
  currentPrice?: number | null;
  onRaisePrice?: (nextPrice: number) => Promise<void> | void;
}

export const SearchingSheet: React.FC<Props> = ({
  onCancel,
  onShowDetails,
  title = 'Ищем машину...',
  cancelLabel = 'Отменить\nпоездку',
  currentPrice = null,
  onRaisePrice,
}) => {
  const [seconds, setSeconds] = useState(0);
  const [raising, setRaising] = useState(false);
  const [raiseError, setRaiseError] = useState<string | null>(null);
  const animValue = useRef(new Animated.Value(0)).current;
  const bottomSheetRef = useRef<BottomSheet>(null);

  const canRaisePrice =
    Boolean(onRaisePrice) && typeof currentPrice === 'number' && currentPrice > 0;
  const showRaise = canRaisePrice && seconds >= RAISE_PROMPT_AFTER;
  const snapPoints = useMemo(() => (showRaise ? ['32%'] : ['22%']), [showRaise]);

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

          {showRaise ? (
            <View style={styles.raiseBlock}>
              <Text style={styles.raiseHint}>
                Пока никто не откликнулся на {currentPrice} ₸. Больше цена — быстрее найдётся
                водитель.
              </Text>
              {raiseError ? <Text style={styles.raiseError}>{raiseError}</Text> : null}
              <TouchableOpacity
                style={styles.raiseBtn}
                disabled={raising}
                onPress={async () => {
                  if (!onRaisePrice || typeof currentPrice !== 'number') {
                    return;
                  }
                  setRaising(true);
                  setRaiseError(null);
                  try {
                    await onRaisePrice(currentPrice + RAISE_STEP);
                  } catch (e: any) {
                    setRaiseError(e?.message || 'Не удалось поднять цену');
                  } finally {
                    setRaising(false);
                  }
                }}
              >
                <Text style={styles.raiseBtnText}>
                  {raising
                    ? 'Поднимаем...'
                    : `Поднять до ${currentPrice + RAISE_STEP} ₸`}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.circleBtnContainer} onPress={onCancel}>
              <View style={styles.circleBtn}>
                <Text style={styles.btnIcon}>✕</Text>
              </View>
              <Text style={styles.btnLabel}>{cancelLabel}</Text>
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
  raiseBlock: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  raiseHint: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  raiseError: {
    color: '#F87171',
    fontSize: 12,
    marginBottom: 8,
  },
  raiseBtn: {
    backgroundColor: '#F4F4F5',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  raiseBtnText: { color: '#09090B', fontSize: 15, fontWeight: '900' },
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
