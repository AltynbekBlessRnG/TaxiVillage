import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
}

/**
 * A strip across the top of the map screens. It ignores touches so the burger
 * menu and the driver's online switch underneath stay usable while it shows.
 */
export const ConnectionBanner: React.FC<Props> = ({ visible }) => {
  const insets = useSafeAreaInsets();

  if (!visible) {
    return null;
  }

  return (
    <View
      style={[styles.banner, { paddingTop: Math.max(insets.top, 12) + 6 }]}
      pointerEvents="none"
    >
      <Text style={styles.text}>Нет соединения. Ждём сеть...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'rgba(127,29,29,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: '#B91C1C',
    zIndex: 200,
  },
  text: {
    color: '#FEE2E2',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
