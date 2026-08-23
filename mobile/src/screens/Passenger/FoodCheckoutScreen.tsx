import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { DarkAlertModal } from '../../components/DarkAlertModal';
import {
  PrimaryButton,
  SectionTitle,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'FoodCheckout'>;
type PaymentMethod = 'CASH' | 'KASPI_TRANSFER';

const createIdempotencyKey = () =>
  `food-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

export const FoodCheckoutScreen: React.FC<Props> = ({ navigation, route }) => {
  const { restaurantName, total, items } = route.params;
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [deliveryFee, setDeliveryFee] = useState(700);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const idempotencyKey = useRef(createIdempotencyKey());
  const [modal, setModal] = useState({
    visible: false,
    title: '',
    message: '',
  });

  const subtotal = Number(total || 0);
  const finalTotal = Math.max(subtotal - discountAmount + deliveryFee, 0);

  useEffect(() => {
    apiClient
      .get(`/merchants/${route.params.restaurantId}/menu`)
      .then((response) => {
        const fee = Number(response.data?.deliveryFee);
        if (Number.isFinite(fee)) setDeliveryFee(fee);
      })
      .catch(() => null);
  }, [route.params.restaurantId]);

  const showError = (title: string, message: string) =>
    setModal({ visible: true, title, message });

  const validatePromo = async () => {
    if (!promoCode.trim()) {
      setDiscountAmount(0);
      return;
    }
    try {
      const response = await apiClient.post('/food-orders/validate-promo', {
        merchantId: route.params.restaurantId,
        promoCode: promoCode.trim(),
        items: items.map((item) => ({
          menuItemId: item.menuItemId,
          qty: item.qty,
        })),
      });
      setDiscountAmount(Number(response.data.discountAmount || 0));
      setDeliveryFee(Number(response.data.deliveryFee || deliveryFee));
    } catch (error: any) {
      setDiscountAmount(0);
      const message = error?.response?.data?.message;
      showError(
        'Промокод не применён',
        Array.isArray(message) ? message.join(', ') : message || 'Проверьте код.',
      );
    }
  };

  const useCurrentLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      showError(
        'Геолокация не разрешена',
        'Можно продолжить и ввести адрес и ориентир вручную.',
      );
      return;
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const coords = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
    setDeliveryCoords(coords);
    const places = await Location.reverseGeocodeAsync({
      latitude: coords.lat,
      longitude: coords.lng,
    }).catch(() => []);
    const place = places[0];
    if (place) {
      setAddress(
        [place.street, place.streetNumber, place.city || place.subregion]
          .filter(Boolean)
          .join(', '),
      );
    }
  };

  const submitOrder = async () => {
    if (!address.trim()) {
      showError('Нужен адрес', 'Укажите адрес доставки перед отправкой заказа.');
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.post(
        '/food-orders',
        {
          merchantId: route.params.restaurantId,
          deliveryAddress: address.trim(),
          deliveryLat: deliveryCoords?.lat,
          deliveryLng: deliveryCoords?.lng,
          comment: comment.trim() || undefined,
          paymentMethod,
          promoCode: promoCode.trim() || undefined,
          items: items.map((item) => ({
            menuItemId: item.menuItemId,
            qty: item.qty,
          })),
        },
        { headers: { 'Idempotency-Key': idempotencyKey.current } },
      );
      if (!response.data?.id) {
        throw new Error('Backend не вернул id заказа');
      }
      navigation.replace('FoodOrderStatus', { orderId: response.data.id });
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message;
      showError(
        'Не удалось создать заказ',
        Array.isArray(message)
          ? message.join(', ')
          : message || 'Проверьте соединение и попробуйте снова.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ServiceScreen
      accentColor="#FB923C"
      eyebrow="Доставка еды"
      title={restaurantName}
      subtitle="Заказ будет принят заведением внутри Zhetysu Go."
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
              <Text style={styles.summaryPrice}>
                {Math.round(Number(item.price) * item.qty)} ₸
              </Text>
            </View>
          ))}
        </View>
      </ServiceCard>

      <ServiceCard>
        <SectionTitle>Доставка</SectionTitle>
        <TextInput
          value={address}
          onChangeText={(value) => {
            setAddress(value);
            setDeliveryCoords(null);
          }}
          style={styles.input}
          placeholder="Адрес и ориентир"
          placeholderTextColor="#71717A"
        />
        <TouchableOpacity style={styles.locationButton} onPress={useCurrentLocation}>
          <Text style={styles.locationButtonText}>
            {deliveryCoords ? 'Геопозиция выбрана' : 'Использовать мою геопозицию'}
          </Text>
        </TouchableOpacity>
        <TextInput
          value={comment}
          onChangeText={setComment}
          style={[styles.input, styles.comment]}
          placeholder="Комментарий к заказу"
          placeholderTextColor="#71717A"
          multiline
        />
      </ServiceCard>

      <ServiceCard>
        <SectionTitle>Оплата</SectionTitle>
        <View style={styles.choiceRow}>
          {([
            ['CASH', 'Наличными'],
            ['KASPI_TRANSFER', 'Перевод Kaspi'],
          ] as const).map(([value, label]) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.choiceButton,
                paymentMethod === value && styles.choiceButtonActive,
              ]}
              onPress={() => setPaymentMethod(value)}
            >
              <Text
                style={[
                  styles.choiceText,
                  paymentMethod === value && styles.choiceTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.paymentHint}>
          Оплата передаётся заведению или водителю. Zhetysu Go пока не списывает
          деньги с карты.
        </Text>
      </ServiceCard>

      <ServiceCard>
        <SectionTitle>Промокод</SectionTitle>
        <View style={styles.promoRow}>
          <TextInput
            value={promoCode}
            onChangeText={(value) => {
              setPromoCode(value.toUpperCase());
              setDiscountAmount(0);
            }}
            style={[styles.input, styles.promoInput]}
            placeholder="USHARAL500"
            placeholderTextColor="#71717A"
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.promoButton} onPress={validatePromo}>
            <Text style={styles.promoButtonText}>Применить</Text>
          </TouchableOpacity>
        </View>
      </ServiceCard>

      <ServiceCard compact>
        <SectionTitle>Итого</SectionTitle>
        <View style={styles.totalBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Блюда</Text>
            <Text style={styles.totalValueSmall}>{Math.round(subtotal)} ₸</Text>
          </View>
          {discountAmount > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.discountLabel}>Скидка</Text>
              <Text style={styles.discountLabel}>
                −{Math.round(discountAmount)} ₸
              </Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Доставка</Text>
            <Text style={styles.totalValueSmall}>{Math.round(deliveryFee)} ₸</Text>
          </View>
          <View style={styles.totalDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalPrimaryLabel}>Итого</Text>
            <Text style={styles.totalPrimaryValue}>{Math.round(finalTotal)} ₸</Text>
          </View>
        </View>
        <Text style={styles.serverNote}>
          Окончательная сумма ещё раз проверяется сервером перед созданием заказа.
        </Text>
      </ServiceCard>

      <PrimaryButton
        title={loading ? 'Отправляем заказ…' : `Заказать • ${Math.round(finalTotal)} ₸`}
        onPress={submitOrder}
        disabled={loading}
      />

      <DarkAlertModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        primaryLabel="Понятно"
        onPrimary={() => setModal({ visible: false, title: '', message: '' })}
      />
    </ServiceScreen>
  );
};

const styles = StyleSheet.create({
  summaryList: { gap: 10 },
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
  summaryLeft: { flex: 1 },
  summaryName: { color: '#F4F4F5', fontSize: 14, fontWeight: '800' },
  summaryQty: { color: '#A1A1AA', fontSize: 12, fontWeight: '600', marginTop: 2 },
  summaryPrice: { color: '#F4F4F5', fontSize: 14, fontWeight: '900' },
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
  comment: { minHeight: 88, textAlignVertical: 'top' },
  locationButton: {
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  locationButtonText: { color: '#FDBA74', fontWeight: '800' },
  choiceRow: { flexDirection: 'row', gap: 10 },
  choiceButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3F3F46',
    paddingVertical: 13,
    alignItems: 'center',
  },
  choiceButtonActive: { backgroundColor: '#3F1F0F', borderColor: '#FB923C' },
  choiceText: { color: '#A1A1AA', fontWeight: '800' },
  choiceTextActive: { color: '#FED7AA' },
  paymentHint: { color: '#A1A1AA', fontSize: 12, lineHeight: 18, marginTop: 12 },
  promoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  promoInput: { flex: 1, marginBottom: 0 },
  promoButton: {
    backgroundColor: '#27272A',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 15,
  },
  promoButtonText: { color: '#F4F4F5', fontWeight: '800' },
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
  totalLabel: { color: '#A1A1AA', fontSize: 13, fontWeight: '700' },
  totalValueSmall: { color: '#E7E5E4', fontSize: 13, fontWeight: '800' },
  discountLabel: { color: '#86EFAC', fontSize: 13, fontWeight: '800' },
  totalDivider: { height: 1, backgroundColor: '#3F3F46', marginVertical: 8 },
  totalPrimaryLabel: { color: '#F4F4F5', fontSize: 15, fontWeight: '900' },
  totalPrimaryValue: { color: '#FB923C', fontSize: 22, fontWeight: '900' },
  serverNote: { color: '#71717A', fontSize: 11, lineHeight: 16, marginTop: 10 },
});
