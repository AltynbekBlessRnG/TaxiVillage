import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  visible: boolean;
}

export const ConnectionBanner: React.FC<Props> = ({ visible }) => {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Соединение потеряно. Ожидание сети...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#7F1D1D',
    borderWidth: 1,
    borderColor: '#B91C1C',
    zIndex: 200,
  },
  text: {
    color: '#FEE2E2',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
