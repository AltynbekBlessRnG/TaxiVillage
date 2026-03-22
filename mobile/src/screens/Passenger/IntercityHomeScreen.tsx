import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  ChipRow,
  PrimaryButton,
  SectionTitle,
  ServiceCard,
  ServiceScreen,
} from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityHome'>;

export const IntercityHomeScreen: React.FC<Props> = ({ navigation }) => {
  const [fromCity, setFromCity] = useState('Алматы');
  const [toCity, setToCity] = useState('Шымкент');
  const [date, setDate] = useState('Сегодня, 18:30');
  const [seats, setSeats] = useState('2');
  const [baggage, setBaggage] = useState('2 чемодана');

  return (
    <ServiceScreen
      accentColor="#38BDF8"
      eyebrow="Межгород"
      title="Поездки между городами"
      subtitle="Travel-like flow: сначала ищем маршрут и предложения, а не живем на локальной городской карте."
      backLabel="К такси"
      onBack={() => navigation.goBack()}
    >
      <ServiceCard>
        <SectionTitle>Маршрут</SectionTitle>
        <TextInput style={styles.input} value={fromCity} onChangeText={setFromCity} placeholderTextColor="#71717A" />
        <TextInput style={styles.input} value={toCity} onChangeText={setToCity} placeholderTextColor="#71717A" />
        <TextInput style={styles.input} value={date} onChangeText={setDate} placeholderTextColor="#71717A" />
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.half]} value={seats} onChangeText={setSeats} placeholderTextColor="#71717A" />
          <TextInput style={[styles.input, styles.half]} value={baggage} onChangeText={setBaggage} placeholderTextColor="#71717A" />
        </View>
      </ServiceCard>

      <ServiceCard compact>
        <ChipRow items={['Комфорт', 'Семейный багаж', 'Ночной выезд', 'Предзаказ']} />
      </ServiceCard>

      <PrimaryButton
        title="Показать предложения"
        onPress={() =>
          navigation.navigate('IntercityOffers', {
            fromCity,
            toCity,
            date,
            seats,
            baggage,
          })
        }
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
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  half: {
    flex: 1,
  },
});
