import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  PrimaryButton,
  SectionTitle,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';
import { openWhatsAppOrder } from '../../utils/foodWhatsapp';

type Props = NativeStackScreenProps<RootStackParamList, 'FoodCheckout'>;

export const FoodCheckoutScreen: React.FC<Props> = ({ navigation, route }) => {
  const { restaurantName, merchantWhatsAppPhone, total, items } = route.params;
  const [address, setAddress] = useState('Жубанова 1а');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const totalNumber = Number(total || 0);
  const deliveryFee = totalNumber > 0 ? 700 : 0;
  const finalTotal = Math.max(totalNumber + deliveryFee, 0);

  const submitOrder = async () => {
    if (!address.trim()) {
      Alert.alert('Нужен адрес', 'Укажи адрес доставки перед отправкой заказа.');
      return;
    }

    if (!merchantWhatsAppPhone?.trim()) {
      Alert.alert('Нет номера ресторана', 'У этого заведения пока не указан WhatsApp для заказов.');
      return;
    }

    setLoading(true);
    try {
      const opened = await openWhatsAppOrder({
        restaurantName,
        phone: merchantWhatsAppPhone,
        items,
        address: address.trim(),
        comment: comment || undefined,
        total: finalTotal,
      });

      if (!opened) {
        Alert.alert(
          'WhatsApp недоступен',
          `Напишите ресторану вручную: ${merchantWhatsAppPhone}`,
          [
            { text: 'Отмена', style: 'cancel' },
            {
              text: 'Позвонить',
              onPress: () => Linking.openURL(`tel:${merchantWhatsAppPhone}`).catch(() => null),
            },
          ],
        );
        return;
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось открыть WhatsApp для заказа.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ServiceScreen
      accentColor="#FB923C"
      eyebrow="Checkout"
      title="Оформление заказа"
      subtitle="Укажи адрес и отправь собранный заказ ресторану в WhatsApp."
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
        <View style={styles.whatsAppNotice}>
          <Text style={styles.whatsAppNoticeLabel}>Заказ уйдет в WhatsApp</Text>
          <Text style={styles.whatsAppNoticeValue}>
            {merchantWhatsAppPhone || 'Номер ресторана пока не указан'}
          </Text>
        </View>
      </ServiceCard>

      <ServiceCard compact>
        <SectionTitle>Итого</SectionTitle>
        <View style={styles.totalBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Блюда</Text>
            <Text style={styles.totalValueSmall}>{Math.round(totalNumber)} тг</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Доставка</Text>
            <Text style={styles.totalValueSmall}>{deliveryFee} тг</Text>
          </View>
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
            ? 'Открываем WhatsApp...'
            : `Заказать в WhatsApp • ${Math.round(finalTotal)} тг`
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
  whatsAppNotice: {
    marginTop: 2,
    backgroundColor: '#143124',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  whatsAppNoticeLabel: {
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  whatsAppNoticeValue: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '700',
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
