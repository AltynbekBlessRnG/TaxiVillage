import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { InlineLabel, PrimaryButton, ServiceCard, ServiceScreen } from '../../components/ServiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'MerchantDashboard'>;

export const MerchantDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');

  const loadProfile = useCallback(() => {
    apiClient
      .get('/merchants/profile/me')
      .then((response) => {
        setProfile(response.data);
        setName(response.data?.name || '');
        setCuisine(response.data?.cuisine || '');
        setCoverImageUrl(response.data?.coverImageUrl || '');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FB923C" />
      </View>
    );
  }

  const saveProfile = async () => {
    try {
      setSaving(true);
      await apiClient.patch('/merchants/profile/me', {
        name: name.trim() || undefined,
        cuisine: cuisine.trim() || undefined,
        coverImageUrl: coverImageUrl.trim() || undefined,
      });
      await loadProfile();
      Alert.alert('Готово', 'Профиль заведения обновлен');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось сохранить профиль';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ServiceScreen
      accentColor="#FB923C"
      eyebrow="Merchant"
      title="Кабинет заведения"
      subtitle="Профиль merchant-а уже читает backend и становится источником данных для food-каталога."
    >
      <ServiceCard>
        <ImageBackground
          source={coverImageUrl ? { uri: coverImageUrl } : undefined}
          style={[styles.coverPreview, { backgroundColor: profile?.tone || '#7C2D12' }]}
          imageStyle={styles.coverPreviewImage}
        />
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholder="Название заведения"
          placeholderTextColor="#71717A"
        />
        <TextInput
          value={cuisine}
          onChangeText={setCuisine}
          style={styles.input}
          placeholder="Кухня"
          placeholderTextColor="#71717A"
        />
        <TextInput
          value={coverImageUrl}
          onChangeText={setCoverImageUrl}
          style={styles.input}
          placeholder="Ссылка на фото заведения"
          placeholderTextColor="#71717A"
        />
        <PrimaryButton
          title={saving ? 'Сохраняем...' : 'Сохранить витрину'}
          onPress={() => saveProfile().catch(() => null)}
        />
      </ServiceCard>

      <ServiceCard>
        <InlineLabel label="Название" value={profile?.name || 'Новое заведение'} />
        <InlineLabel label="Кухня" value={profile?.cuisine || 'Не указана'} />
        <InlineLabel label="Открыто" value={profile?.isOpen ? 'Да' : 'Нет'} accentColor="#FB923C" />
        <InlineLabel label="Меню" value={`${profile?.menuCategories?.length || 0} категорий`} />
      </ServiceCard>
      <PrimaryButton title="Открыть заказы" onPress={() => navigation.navigate('MerchantOrders')} />
      <PrimaryButton title="Редактор меню" onPress={() => navigation.navigate('MenuEditor')} accentColor="#F4F4F5" />
    </ServiceScreen>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090B',
  },
  coverPreview: {
    borderRadius: 18,
    minHeight: 160,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: '#27272A',
  },
  coverPreviewImage: {
    borderRadius: 18,
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
});
