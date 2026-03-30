import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import {
  ChipRow,
  PrimaryButton,
  SectionTitle,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'FoodCheckout'>;

export const FoodCheckoutScreen: React.FC<Props> = ({ navigation, route }) => {
  const { restaurantId, total, items } = route.params;
  const [address, setAddress] = useState('Жубанова 1а');
  const [comment, setComment] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [validatedPromoCode, setValidatedPromoCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totalNumber = Number(total || 0);
  const deliveryFee = totalNumber > 0 ? 700 : 0;
  const finalTotal = Math.max(totalNumber + deliveryFee - discountAmount, 0);

  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      setDiscountAmount(0);
      setValidatedPromoCode(null);
      return;
    }

    try {
      const response = await apiClient.post('/food-orders/validate-promo', {
        merchantId: restaurantId,
        promoCode: promoCode.trim(),
        items: items.map((item) => ({
          menuItemId: item.menuItemId,
          qty: item.qty,
        })),
      });
      setDiscountAmount(Number(response.data?.discountAmount || 0));
      setValidatedPromoCode(response.data?.code || promoCode.trim().toUpperCase());
      Alert.alert('Промокод применен', `Скидка ${Math.round(Number(response.data?.discountAmount || 0))} тг`);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Промокод не подошел';
      setDiscountAmount(0);
      setValidatedPromoCode(null);
      Alert.alert('Промокод', Array.isArray(message) ? message.join(', ') : message);
    }
  };

  const submitOrder = async () => {
    setLoading(true);
    try {
      const response = await apiClient.post('/food-orders', {
        merchantId: restaurantId,
        deliveryAddress: address,
        comment: comment || undefined,
        items: items.map((item) => ({
          menuItemId: item.menuItemId,
          qty: item.qty,
        })),
        promoCode: validatedPromoCode || undefined,
      });

      navigation.navigate('FoodOrderStatus', { orderId: response.data.id });
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось оформить заказ';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ServiceScreen
      accentColor="#FB923C"
      eyebrow="Checkout"
      title="Оформление заказа"
      subtitle="Проверь адрес, промокод и сумму перед подтверждением заказа."
      backLabel="К корзине"
      onBack={() => navigation.goBack()}
    >
      <ServiceCard compact>
        <SectionTitle>Состав заказа</SectionTitle>
        <View style={styles.summaryList}>
          {items.map((item) => (
            <View key={item.menuItemId} style={styles.summaryRow}>
              <View style={styles.summaryLeft}>
                <Text style={styles.summaryName}>{item.name}</Text>
                <Text style={styles.summaryQty}>{item.qty} шт.</Text>
              </View>
              <Text style={styles.summaryPrice}>{Math.round(Number(item.price) * item.qty)} тг</Text>
            </View>
          ))}
        </View>
      </ServiceCard>

      <ServiceCard>
        <SectionTitle>Куда доставить</SectionTitle>
        <TextInput
          value={address}
          onChangeText={setAddress}
          style={styles.input}
          placeholder="Адрес доставки"
          placeholderTextColor="#71717A"
        />
        <TextInput
          value={comment}
          onChangeText={setComment}
          style={[styles.input, styles.comment]}
          placeholder="Комментарий к заказу"
          placeholderTextColor="#71717A"
          multiline
        />
        <TextInput
          value={promoCode}
          onChangeText={(value) => {
            setPromoCode(value);
            setValidatedPromoCode(null);
            setDiscountAmount(0);
          }}
          style={styles.input}
          placeholder="Промокод"
          placeholderTextColor="#71717A"
          autoCapitalize="characters"
        />
        <PrimaryButton title="Применить промокод" onPress={validatePromoCode} accentColor="#F4F4F5" />
      </ServiceCard>

      <ServiceCard compact>
        <SectionTitle>Оплата</SectionTitle>
        <ChipRow items={['Наличные', 'Kaspi', 'Карта']} />
        <View style={styles.totalBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Блюда</Text>
            <Text style={styles.totalValueSmall}>{Math.round(totalNumber)} тг</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Доставка</Text>
            <Text style={styles.totalValueSmall}>{deliveryFee} тг</Text>
          </View>
          {discountAmount > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.discountLabel}>Скидка {validatedPromoCode ? `(${validatedPromoCode})` : ''}</Text>
              <Text style={styles.discountValue}>−{Math.round(discountAmount)} тг</Text>
            </View>
          ) : null}
          <View style={styles.totalDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalPrimaryLabel}>Итого</Text>
            <Text style={styles.totalPrimaryValue}>{Math.round(finalTotal)} тг</Text>
          </View>
        </View>
      </ServiceCard>

      <PrimaryButton
        title={
          loading
            ? 'Создаем заказ...'
            : `Подтвердить за ${Math.round(finalTotal)} тг`
        }
        onPress={submitOrder}
      />
    </ServiceScreen>
  );
};

const styles = StyleSheet.create({
  summaryList: {
    gap: 10,
  },
  summaryRow: {
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
  summaryLeft: {
    flex: 1,
  },
  summaryName: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  summaryQty: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryPrice: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '900',
  },
  input: {
    backgroundColor: '#09090B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#F4F4F5',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  comment: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  totalBox: {
    marginTop: 14,
    backgroundColor: '#1C1917',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#3F3F46',
    padding: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  totalLabel: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
  },
  totalValueSmall: {
    color: '#E7E5E4',
    fontSize: 13,
    fontWeight: '800',
  },
  discountLabel: {
    color: '#FDBA74',
    fontSize: 13,
    fontWeight: '700',
  },
  discountValue: {
    color: '#FED7AA',
    fontSize: 13,
    fontWeight: '800',
  },
  totalDivider: {
    height: 1,
    backgroundColor: '#3F3F46',
    marginVertical: 8,
  },
  totalPrimaryLabel: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '900',
  },
  totalPrimaryValue: {
    color: '#FB923C',
    fontSize: 22,
    fontWeight: '900',
  },
});
