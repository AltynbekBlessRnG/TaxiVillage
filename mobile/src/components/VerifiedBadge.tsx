import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

/**
 * "Документы проверены": an admin approved the driver's license and car
 * registration (or courier ID). Renders nothing for an unchecked driver, so
 * callers can pass the flag straight through.
 */
export const VerifiedBadge: React.FC<{ verified?: boolean | null }> = ({ verified }) => {
  if (!verified) {
    return null;
  }
  return (
    <View style={styles.badge} accessibilityRole="text" accessibilityLabel="Документы водителя проверены">
      <Ionicons name="shield-checkmark" size={13} color={colors.successText} />
      <Text style={styles.text}>Документы проверены</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  text: {
    color: colors.successText,
    fontSize: 11,
    fontWeight: '800',
  },
});
