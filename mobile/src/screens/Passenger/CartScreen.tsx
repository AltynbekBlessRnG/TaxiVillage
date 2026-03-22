import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  InlineLabel,
  PrimaryButton,
  SectionTitle,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Cart'>;

export const CartScreen: React.FC<Props> = ({ navigation, route }) => {
  const { restaurantId, restaurantName, items } = route.params;
  const subtotal = items.reduce((sum, item) => sum + parseInt(item.price, 10) * item.qty, 0);
  const delivery = 1200;
  const total = subtotal + delivery;

  return (
    <ServiceScreen
      accentColor="#FB923C"
      eyebrow="Корзина"
      title={restaurantName}
      subtitle="Плавающая корзина для flow еды. Здесь потом легко добавить промокоды, адреса и способы оплаты."
      backLabel="К меню"
      onBack={() => navigation.goBack()}
    >
      <ServiceCard>
        <SectionTitle>Ваш заказ</SectionTitle>
        {items.map((item) => (
          <InlineLabel
            key={`${item.name}-${item.qty}`}
            label={`${item.qty} x ${item.name}`}
            value={item.price}
            accentColor="#FB923C"
          />
        ))}
      </ServiceCard>

      <ServiceCard compact>
        <InlineLabel label="Сумма блюд" value={`${subtotal} тг`} />
        <InlineLabel label="Доставка" value={`${delivery} тг`} />
        <InlineLabel label="Итого" value={`${total} тг`} accentColor="#60A5FA" />
      </ServiceCard>

      <PrimaryButton
        title="Перейти к оформлению"
        onPress={() =>
          navigation.navigate('FoodCheckout', {
            restaurantId,
            restaurantName,
            total: `${total}`,
            items,
          })
        }
      />
    </ServiceScreen>
  );
};
