import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';

type Option = {
  label: string;
  value: string;
};

type Props = {
  visible: boolean;
  title: string;
  options: Option[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

export const OptionPickerModal: React.FC<Props> = ({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.card} onPress={() => null}>
        <Text style={styles.title}>{title}</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {options.map((option) => {
            const active = option.value === selectedValue;
            return (
              <TouchableOpacity
                key={`${title}-${option.value}`}
                style={[styles.option, active && styles.optionActive]}
                activeOpacity={0.9}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.72)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    maxHeight: '78%',
    backgroundColor: colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 14,
  },
  list: {
    gap: 10,
  },
  option: {
    backgroundColor: colors.bg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  optionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceSunken,
  },
  optionText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  optionTextActive: {
    color: colors.accentTextSoft,
  },
});
