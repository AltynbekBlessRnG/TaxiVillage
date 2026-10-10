import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';

const legalBaseUrl = (
  process.env.EXPO_PUBLIC_LEGAL_BASE_URL || 'https://taxivillage-docs-xp2f.onrender.com'
).replace(/\/+$/, '');

const links = [
  { label: 'Политика конфиденциальности', url: `${legalBaseUrl}/privacy-policy.html` },
  { label: 'Условия использования', url: `${legalBaseUrl}/terms.html` },
  { label: 'Удаление аккаунта', url: `${legalBaseUrl}/delete-account.html` },
  { label: 'Поддержка', url: `${legalBaseUrl}/support.html` },
];

export const LegalLinks: React.FC = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Помощь и документы</Text>
    <View style={styles.links}>
      {links.map((item) => (
        <TouchableOpacity
          key={item.label}
          accessibilityRole="link"
          onPress={() => Linking.openURL(item.url).catch(() => null)}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>{item.label}</Text>
          <Text style={styles.arrow}>↗</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  links: { gap: 2 },
  linkButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  arrow: { color: colors.textTertiary, fontSize: 16 },
});
