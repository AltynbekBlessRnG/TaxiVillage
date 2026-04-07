import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
    backgroundColor: '#141418',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 18,
  },
  title: {
    color: '#F4F4F5',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 14,
  },
  list: {
    gap: 10,
  },
  option: {
    backgroundColor: '#0B0B0E',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  optionActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#0F172A',
  },
  optionText: {
    color: '#E4E4E7',
    fontSize: 15,
    fontWeight: '700',
  },
  optionTextActive: {
    color: '#DBF0FF',
  },
});
