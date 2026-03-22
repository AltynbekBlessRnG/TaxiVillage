import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'CourierHome'>;

export const CourierHomeScreen: React.FC<Props> = ({ navigation }) => {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [item, setItem] = useState('');
  const [weight, setWeight] = useState('');
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateOrder = async () => {
    if (!pickup || !dropoff || !item) {
      Alert.alert('Не хватает данных', 'Заполни адрес забора, адрес доставки и описание посылки.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/courier-orders', {
        pickupAddress: pickup,
        dropoffAddress: dropoff,
        itemDescription: item,
        packageWeight: weight || undefined,
        packageSize: undefined,
        comment: comment || undefined,
        estimatedPrice: price ? Number(price) : undefined,
      });

      navigation.navigate('CourierStatus', { orderId: response.data.id });
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Не удалось создать курьерский заказ';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Курьер</Text>
          <Text style={styles.title}>Доставка по городу</Text>
          <Text style={styles.subtitle}>Оформи быструю отправку документов, техники или личных вещей.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Маршрут</Text>
          <TextInput
            style={styles.input}
            placeholder="Откуда забрать"
            placeholderTextColor="#71717A"
            value={pickup}
            onChangeText={setPickup}
          />
          <TextInput
            style={styles.input}
            placeholder="Куда доставить"
            placeholderTextColor="#71717A"
            value={dropoff}
            onChangeText={setDropoff}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Что везем</Text>
          <TextInput
            style={styles.input}
            placeholder="Описание посылки"
            placeholderTextColor="#71717A"
            value={item}
            onChangeText={setItem}
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Вес"
              placeholderTextColor="#71717A"
              value={weight}
              onChangeText={setWeight}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Цена"
              placeholderTextColor="#71717A"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
            />
          </View>
          <TextInput
            style={[styles.input, styles.commentInput]}
            placeholder="Комментарий для курьера"
            placeholderTextColor="#71717A"
            value={comment}
            onChangeText={setComment}
            multiline
          />
        </View>

        <View style={styles.tagRow}>
          <View style={styles.tag}><Text style={styles.tagText}>Документы</Text></View>
          <View style={styles.tag}><Text style={styles.tagText}>Техника</Text></View>
          <View style={styles.tag}><Text style={styles.tagText}>Хрупкое</Text></View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleCreateOrder}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? 'Создаем заказ...' : 'Заказать курьера'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  content: { padding: 20, paddingTop: 64, paddingBottom: 36 },
  hero: { marginBottom: 22 },
  eyebrow: { color: '#F59E0B', fontSize: 16, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase' },
  title: { color: '#F4F4F5', fontSize: 30, fontWeight: '900', marginBottom: 8 },
  subtitle: { color: '#A1A1AA', fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: '#18181B',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 14,
  },
  sectionTitle: { color: '#F4F4F5', fontSize: 17, fontWeight: '700', marginBottom: 12 },
  input: {
    backgroundColor: '#09090B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#F4F4F5',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },
  commentInput: { minHeight: 82, textAlignVertical: 'top' },
  tagRow: { flexDirection: 'row', gap: 8, marginBottom: 18, marginTop: 6 },
  tag: { backgroundColor: '#111827', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#1F2937' },
  tagText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  primaryButton: { backgroundColor: '#F4F4F5', borderRadius: 20, alignItems: 'center', paddingVertical: 18 },
  primaryButtonText: { color: '#09090B', fontSize: 17, fontWeight: '900' },
});
