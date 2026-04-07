import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  PrimaryButton,
  SectionTitle,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Cart'>;

export const CartScreen: React.FC<Props> = ({ navigation, route }) => {
  const { restaurantId, restaurantName, merchantWhatsAppPhone, items } = route.params;
  const [cartItems, setCartItems] = useState(items);
  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + parseInt(item.price, 10) * item.qty, 0),
    [cartItems],
  );
  const delivery = 1200;
  const total = subtotal + delivery;

  const updateQty = (menuItemId: string, delta: number) => {
    setCartItems((current) =>
      current
        .map((item) =>
          item.menuItemId === menuItemId ? { ...item, qty: Math.max(item.qty + delta, 0) } : item,
        )
        .filter((item) => item.qty > 0),
    );
  };

  return (
    <ServiceScreen
      accentColor="#FB923C"
      eyebrow="Корзина"
      title={restaurantName}
      subtitle="Собери заказ и передай его ресторану в WhatsApp."
      backLabel="К меню"
      onBack={() => navigation.goBack()}
    >
      <ServiceCard>
        <SectionTitle>Ваш заказ</SectionTitle>
        <View style={styles.list}>
          {cartItems.map((item) => (
            <View key={item.menuItemId} style={styles.row}>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSubtitle}>{Math.round(Number(item.price) * item.qty)} тг</Text>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={[styles.stepperButton, styles.stepperButtonGhost]}
                  onPress={() => updateQty(item.menuItemId, -1)}
                >
                  <Text style={styles.stepperButtonGhostText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{item.qty}</Text>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() => updateQty(item.menuItemId, 1)}
                >
                  <Text style={styles.stepperButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ServiceCard>

      <ServiceCard compact>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Сумма блюд</Text>
          <Text style={styles.totalValue}>{subtotal} тг</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Доставка</Text>
          <Text style={styles.totalValue}>{delivery} тг</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabelAccent}>Итого</Text>
          <Text style={styles.totalValueAccent}>{total} тг</Text>
        </View>
      </ServiceCard>

      <PrimaryButton
        title="К адресу и WhatsApp"
        onPress={() =>
          navigation.navigate('FoodCheckout', {
            restaurantId,
            restaurantName,
            merchantWhatsAppPhone,
            total: `${total}`,
            items: cartItems,
          })
        }
      />
    </ServiceScreen>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowMeta: {
    flex: 1,
  },
  rowTitle: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  rowSubtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2D160B',
    borderWidth: 1,
    borderColor: '#FB923C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonGhost: {
    backgroundColor: '#18181B',
    borderColor: '#3F3F46',
  },
  stepperButtonText: {
    color: '#FED7AA',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 19,
  },
  stepperButtonGhostText: {
    color: '#F4F4F5',
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 21,
  },
  stepperValue: {
    minWidth: 18,
    textAlign: 'center',
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '900',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 12,
  },
  totalLabel: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '700',
  },
  totalValue: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '800',
  },
  totalLabelAccent: {
    color: '#60A5FA',
    fontSize: 15,
    fontWeight: '900',
  },
  totalValueAccent: {
    color: '#60A5FA',
    fontSize: 18,
    fontWeight: '900',
  },
});
