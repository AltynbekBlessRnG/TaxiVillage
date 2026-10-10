import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { colors } from '../../theme/colors';

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
  const reduceMotion = useReduceMotion();

  const canRaisePrice =
    Boolean(onRaisePrice) && typeof currentPrice === 'number' && currentPrice > 0;
  const showRaise = canRaisePrice && seconds >= RAISE_PROMPT_AFTER;
  const snapPoints = useMemo(() => (showRaise ? ['32%'] : ['22%']), [showRaise]);

  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      // A still segment of the bar instead of an endless sweep.
      animValue.setValue(0.35);
      return undefined;
    }

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
      animation.stop();
      animValue.setValue(0);
    };
  }, [animValue, reduceMotion]);

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
            <TouchableOpacity
              style={styles.circleBtnContainer}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel.replace(/\s+/g, ' ')}
            >
              <View style={styles.circleBtn}>
                <Text style={styles.btnIcon}>✕</Text>
              </View>
              <Text style={styles.btnLabel}>{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.circleBtnContainer}
              onPress={onShowDetails}
              accessibilityRole="button"
              accessibilityLabel="Детали заказа"
            >
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
    backgroundColor: colors.surfaceSunken,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    paddingTop: 10,
  },
  handleIndicator: {
    backgroundColor: colors.borderStrong,
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
  title: { color: colors.white, fontSize: 18, fontWeight: '800', flex: 1 },
  timer: { color: colors.white, fontSize: 14, fontWeight: '600', marginLeft: 12 },
  progressBarBg: {
    height: 3,
    backgroundColor: colors.surfaceRaised,
    width: '100%',
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.white,
    width: '40%',
    position: 'absolute',
  },
  raiseBlock: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  raiseHint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  raiseError: {
    color: colors.dangerTextStrong,
    fontSize: 12,
    marginBottom: 8,
  },
  raiseBtn: {
    backgroundColor: colors.surfaceInverse,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  raiseBtnText: { color: colors.textInverse, fontSize: 15, fontWeight: '900' },
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
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnIcon: { color: colors.white, fontSize: 18 },
  btnLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
});
