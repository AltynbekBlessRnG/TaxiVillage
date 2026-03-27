import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type ServiceScreenProps = {
  accentColor: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  backLabel?: string;
  onBack?: () => void;
  children: React.ReactNode;
};

export const ServiceScreen: React.FC<ServiceScreenProps> = ({
  accentColor,
  eyebrow,
  title,
  subtitle,
  backLabel = 'Назад',
  onBack,
  children,
}) => (
  <SafeAreaView style={styles.container}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          {onBack ? (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Text style={styles.backText}>← {backLabel}</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={[styles.eyebrow, { color: accentColor }]}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
);

export const ServiceCard: React.FC<{ children: React.ReactNode; compact?: boolean }> = ({
  children,
  compact = false,
}) => <View style={[styles.card, compact && styles.compactCard]}>{children}</View>;

export const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

export const PrimaryButton: React.FC<{
  title: string;
  onPress: () => void;
  accentColor?: string;
}> = ({ title, onPress, accentColor = '#F4F4F5' }) => (
  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: accentColor }]} onPress={onPress}>
    <Text style={styles.primaryButtonText}>{title}</Text>
  </TouchableOpacity>
);

export const SecondaryButton: React.FC<{
  title: string;
  onPress: () => void;
}> = ({ title, onPress }) => (
  <TouchableOpacity style={styles.secondaryButton} onPress={onPress}>
    <Text style={styles.secondaryButtonText}>{title}</Text>
  </TouchableOpacity>
);

export const InlineLabel: React.FC<{ label: string; value: string; accentColor?: string }> = ({
  label,
  value,
  accentColor = '#F4F4F5',
}) => (
  <View style={styles.inlineLabel}>
    <Text style={styles.inlineLabelText}>{label}</Text>
    <Text style={[styles.inlineValueText, { color: accentColor }]}>{value}</Text>
  </View>
);

export const ChipRow: React.FC<{ items: string[] }> = ({ items }) => (
  <View style={styles.chipRow}>
    {items.map((item) => (
      <View key={item} style={styles.chip}>
        <Text style={styles.chipText}>{item}</Text>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
  },
  header: {
    marginBottom: 18,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#18181B',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  backText: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '700',
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#F4F4F5',
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    color: '#A1A1AA',
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#18181B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 18,
    marginBottom: 14,
  },
  compactCard: {
    padding: 14,
    borderRadius: 20,
  },
  sectionTitle: {
    color: '#F4F4F5',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  primaryButton: {
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButtonText: {
    color: '#09090B',
    fontSize: 17,
    fontWeight: '900',
  },
  secondaryButton: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#121216',
  },
  secondaryButtonText: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
  },
  inlineLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inlineLabelText: {
    color: '#A1A1AA',
    fontSize: 14,
  },
  inlineValueText: {
    fontSize: 15,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#0F172A',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
});
