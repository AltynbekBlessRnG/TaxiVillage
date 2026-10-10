import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Shared across screens so a screen mounted after the first read starts with
// the right answer instead of animating once before the query returns.
let lastKnown = false;

/**
 * Whether the user turned on Reduce Motion (iOS) or Remove animations
 * (Android). When true, slides and endless pulses should become instant
 * cuts or still frames; motion the user drives with a finger can stay.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(lastKnown);

  useEffect(() => {
    let mounted = true;
    const apply = (value: boolean) => {
      lastKnown = value;
      if (mounted) {
        setReduceMotion(value);
      }
    };

    AccessibilityInfo.isReduceMotionEnabled().then(apply).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', apply);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
