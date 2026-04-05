import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onPrimary}>
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
    backgroundColor: '#111113',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 20,
  },
  title: {
    color: '#F4F4F5',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 10,
  },
  message: {
    color: '#A1A1AA',
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
    borderColor: '#3F3F46',
    backgroundColor: '#18181B',
  },
  secondaryButtonText: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F97316',
  },
  primaryButtonDanger: {
    backgroundColor: '#3F1518',
  },
  primaryButtonText: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '900',
  },
  primaryButtonTextDanger: {
    color: '#FCA5A5',
  },
});
