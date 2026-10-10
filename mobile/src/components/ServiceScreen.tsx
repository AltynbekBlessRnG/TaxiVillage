import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

type ServiceScreenProps = {
  accentColor: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
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
  <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={styles.header}>
          {onBack ? (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Text style={styles.backText}>← {backLabel}</Text>
            </TouchableOpacity>
          ) : null}
          {eyebrow ? (
            <View style={styles.headerBadgeRow}>
              <View style={[styles.eyebrowBadge, { borderColor: `${accentColor}55`, backgroundColor: `${accentColor}15` }]}>
                <Text style={[styles.eyebrow, { color: accentColor }]}>{eyebrow}</Text>
              </View>
            </View>
          ) : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.headerDivider} />
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
  disabled?: boolean;
}> = ({ title, onPress, accentColor = colors.text, disabled = false }) => (
  <TouchableOpacity
    style={[
      styles.primaryButton,
      { backgroundColor: accentColor },
      disabled && { opacity: 0.55 },
    ]}
    onPress={onPress}
    activeOpacity={0.9}
    disabled={disabled}
  >
    <Text style={styles.primaryButtonText}>{title}</Text>
  </TouchableOpacity>
);

export const SecondaryButton: React.FC<{
  title: string;
  onPress: () => void;
}> = ({ title, onPress }) => (
  <TouchableOpacity style={styles.secondaryButton} onPress={onPress} activeOpacity={0.9}>
    <Text style={styles.secondaryButtonText}>{title}</Text>
  </TouchableOpacity>
);

export const InlineLabel: React.FC<{ label: string; value: string; accentColor?: string }> = ({
  label,
  value,
  accentColor = colors.text,
}) => (
  <View style={styles.inlineLabel}>
    <Text style={styles.inlineLabelText}>{label}</Text>
    <Text style={[styles.inlineValueText, { color: accentColor }]} numberOfLines={2}>
      {value}
    </Text>
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
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 96,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 18,
  },
  backText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  headerBadgeRow: {
    marginBottom: 10,
  },
  eyebrowBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    marginBottom: 10,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.surface,
    marginTop: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 16,
  },
  compactCard: {
    padding: 16,
    borderRadius: 22,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  primaryButton: {
    borderRadius: 20,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontSize: 17,
    fontWeight: '900',
  },
  secondaryButton: {
    borderRadius: 18,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  inlineLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 16,
  },
  inlineLabelText: {
    color: colors.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  inlineValueText: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    textAlign: 'right',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
});
