import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryVariant?: 'default' | 'danger';
  onPrimary: () => void;
  onSecondary?: () => void;
};

export const DarkAlertModal: React.FC<Props> = ({
  visible,
  title,
  message,
  primaryLabel = 'Понятно',
  secondaryLabel,
  primaryVariant = 'default',
  onPrimary,
  onSecondary,
}) => {
  return (
    // Back means "never mind": on a confirmation it must take the safe
    // choice, never the destructive primary one.
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSecondary ?? onPrimary}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            {secondaryLabel ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={onSecondary}>
                <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                primaryVariant === 'danger' && styles.primaryButtonDanger,
              ]}
              onPress={onPrimary}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  primaryVariant === 'danger' && styles.primaryButtonTextDanger,
                ]}
              >
                {primaryLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surfaceSunken,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 10,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.foodStrong,
  },
  primaryButtonDanger: {
    backgroundColor: colors.dangerSurface,
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '900',
  },
  primaryButtonTextDanger: {
    color: colors.dangerText,
  },
});
