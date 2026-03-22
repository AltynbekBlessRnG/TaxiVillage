import React, { useState } from 'react';
import { Alert, StyleSheet, TextInput } from 'react-native';
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
  const [loading, setLoading] = useState(false);

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
      });

      navigation.replace('FoodOrderStatus', { orderId: response.data.id });
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
      subtitle="Customer-side checkout теперь отправляет реальный `FoodOrder` в backend."
      backLabel="К корзине"
      onBack={() => navigation.goBack()}
    >
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
      </ServiceCard>

      <ServiceCard compact>
        <SectionTitle>Оплата</SectionTitle>
        <ChipRow items={['Наличные', 'Kaspi', 'Карта']} />
      </ServiceCard>

      <PrimaryButton
        title={loading ? 'Создаем заказ...' : `Подтвердить за ${total} тг`}
        onPress={submitOrder}
      />
    </ServiceScreen>
  );
};

const styles = StyleSheet.create({
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
});
