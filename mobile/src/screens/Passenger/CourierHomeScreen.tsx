import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { SearchSheet } from '../../components/Passenger/SearchSheet';
import { buildRegion, buildRouteCoordinates, toMapPoint } from '../../utils/map';
import { darkMinimalMapStyle } from '../../utils/mapStyle';
import { geocodeAddressWithGoogle, reverseGeocodeWithGoogle } from '../../utils/googleMaps';
import { saveRecentAddress } from '../../storage/recentAddresses';

const { height } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'CourierHome'>;
type ScreenState = 'IDLE' | 'SEARCH' | 'MAP_PICK' | 'ORDER_SETUP';

const hasValidCoordinates = (coords?: { lat: number; lng: number } | null) =>
  !!coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng) && !(coords.lat === 0 && coords.lng === 0);

export const CourierHomeScreen: React.FC<Props> = ({ navigation }) => {
  const [screenState, setScreenState] = useState<ScreenState>('IDLE');
  const [pickupAddress, setPickupAddress] = useState('Определяем адрес...');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupCoord, setPickupCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoord, setDropoffCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [itemDescription, setItemDescription] = useState('');
  const [packageWeight, setPackageWeight] = useState('');
  const [packageSize, setPackageSize] = useState('');
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapPickTarget, setMapPickTarget] = useState<'pickup' | 'dropoff'>('dropoff');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const searchSheetAnim = useRef(new Animated.Value(height)).current;
  const mapRef = useRef<MapView>(null);

  const resetDraft = useCallback(() => {
    setDropoffAddress('');
    setDropoffCoord(null);
    setItemDescription('');
    setPackageWeight('');
    setPackageSize('');
    setPrice('');
    setComment('');
    setMapPickTarget('dropoff');
  }, []);

  const changeState = useCallback((nextState: ScreenState) => {
    Animated.timing(searchSheetAnim, {
      toValue: nextState === 'SEARCH' ? height * 0.1 : height,
      duration: 280,
      useNativeDriver: true,
    }).start();
    setScreenState(nextState);
  }, [searchSheetAnim]);

  const loadCurrentOrder = useCallback(async () => {
    try {
      const response = await apiClient.get('/courier-orders/current');
      setActiveOrderId(response.data?.id ?? null);
      return response.data ?? null;
    } catch {
      setActiveOrderId(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      setUserLocation(coords);
      setPickupCoord(coords);
      setMapCenter(coords);
      const address = await reverseGeocodeWithGoogle(coords.lat, coords.lng).catch(() => 'Текущая точка');
      setPickupAddress(address);
      await saveRecentAddress(address, coords.lat, coords.lng);
      mapRef.current?.animateToRegion(
        {
          latitude: coords.lat,
          longitude: coords.lng,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        300,
      );
    };

    init().catch(() => null);
    loadCurrentOrder().catch(() => null);
    const unsubscribe = navigation.addListener('focus', () => {
      loadCurrentOrder().catch(() => null);
    });
    return unsubscribe;
  }, [loadCurrentOrder, navigation]);

  const routeCoordinates = useMemo(
    () =>
      buildRouteCoordinates({
        fromLat: pickupCoord?.lat,
        fromLng: pickupCoord?.lng,
        toLat: dropoffCoord?.lat,
        toLng: dropoffCoord?.lng,
      }),
    [dropoffCoord?.lat, dropoffCoord?.lng, pickupCoord?.lat, pickupCoord?.lng],
  );

  const initialRegion = useMemo(
    () =>
      buildRegion(routeCoordinates, toMapPoint(userLocation?.lat, userLocation?.lng) ?? {
        latitude: 43.2389,
        longitude: 76.8897,
      }),
    [routeCoordinates, userLocation?.lat, userLocation?.lng],
  );

  const handleAddressSelect = useCallback((field: 'from' | 'to', address: string, lat: number, lng: number) => {
    if (field === 'from') {
      setPickupAddress(address);
      setPickupCoord({ lat, lng });
      return;
    }

    setDropoffAddress(address);
    setDropoffCoord({ lat, lng });
  }, []);

  const handleSubmitRoute = useCallback(async () => {
    if (!dropoffAddress.trim()) {
      Alert.alert('Нужен адрес', 'Укажите точку доставки.');
      return;
    }

    setLoading(true);
    try {
      const pickupResult = hasValidCoordinates(pickupCoord)
        ? null
        : await geocodeAddressWithGoogle(pickupAddress, userLocation).catch(() => null);
      const dropoffResult = hasValidCoordinates(dropoffCoord)
        ? null
        : await geocodeAddressWithGoogle(dropoffAddress, userLocation).catch(() => null);

      if (pickupResult) {
        setPickupAddress(pickupResult.address);
        setPickupCoord({ lat: pickupResult.lat, lng: pickupResult.lng });
      }
      if (dropoffResult) {
        setDropoffAddress(dropoffResult.address);
        setDropoffCoord({ lat: dropoffResult.lat, lng: dropoffResult.lng });
      }

      changeState('ORDER_SETUP');
    } finally {
      setLoading(false);
    }
  }, [changeState, dropoffAddress, dropoffCoord, pickupAddress, pickupCoord, userLocation]);

  const handleCreateOrder = useCallback(async () => {
    if (!itemDescription.trim()) {
      Alert.alert('Не хватает данных', 'Опишите, что нужно доставить.');
      return;
    }

    if (!hasValidCoordinates(pickupCoord) || !hasValidCoordinates(dropoffCoord)) {
      Alert.alert('Нужны координаты', 'Выберите точки забора и доставки из подсказок или на карте.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/courier-orders', {
        pickupAddress,
        pickupLat: pickupCoord!.lat,
        pickupLng: pickupCoord!.lng,
        dropoffAddress,
        dropoffLat: dropoffCoord!.lat,
        dropoffLng: dropoffCoord!.lng,
        itemDescription: itemDescription.trim(),
        packageWeight: packageWeight.trim() || undefined,
        packageSize: packageSize.trim() || undefined,
        comment: comment.trim() || undefined,
        estimatedPrice: price.trim() ? Number(price) : undefined,
      });

      setActiveOrderId(response.data.id);
      navigation.navigate('CourierStatus', { orderId: response.data.id });
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось создать курьерский заказ';
      Alert.alert('Ошибка', Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  }, [comment, dropoffAddress, dropoffCoord, itemDescription, navigation, packageSize, packageWeight, pickupAddress, pickupCoord, price]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        mapType="standard"
        customMapStyle={darkMinimalMapStyle}
        onRegionChangeComplete={(region) => {
          if (screenState === 'MAP_PICK') {
            setMapCenter({ lat: region.latitude, lng: region.longitude });
          }
        }}
      >
        {pickupCoord ? (
          <Marker coordinate={{ latitude: pickupCoord.lat, longitude: pickupCoord.lng }} title="Забор" pinColor="#2563EB" />
        ) : null}
        {dropoffCoord ? (
          <Marker coordinate={{ latitude: dropoffCoord.lat, longitude: dropoffCoord.lng }} title="Доставка" pinColor="#DC2626" />
        ) : null}
        {routeCoordinates.length >= 2 ? (
          <Polyline coordinates={routeCoordinates} strokeColor="#F59E0B" strokeWidth={4} lineDashPattern={[8, 6]} />
        ) : null}
      </MapView>

      {screenState === 'MAP_PICK' ? (
        <View style={styles.centerPinContainer} pointerEvents="none">
          <View style={styles.centerPin} />
        </View>
      ) : null}

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('PassengerHome', {})}>
        <Text style={styles.backBtnText}>← На главную</Text>
      </TouchableOpacity>

      <View style={styles.searchCard}>
        <TouchableOpacity style={styles.row} onPress={() => changeState('SEARCH')}>
          <View style={[styles.dot, { backgroundColor: '#2563EB' }]} />
          <Text style={styles.addressText} numberOfLines={1}>{pickupAddress}</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} onPress={() => changeState('SEARCH')}>
          <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
          <Text style={dropoffAddress ? styles.addressText : styles.placeholderText} numberOfLines={1}>
            {dropoffAddress || 'Куда доставить?'}
          </Text>
        </TouchableOpacity>
      </View>

      {activeOrderId ? (
        <TouchableOpacity style={styles.activeOrderBanner} onPress={() => navigation.navigate('CourierStatus', { orderId: activeOrderId })}>
          <Text style={styles.activeOrderTitle}>У вас есть активная доставка</Text>
          <Text style={styles.activeOrderSubtext}>Открыть заказ</Text>
        </TouchableOpacity>
      ) : null}

      {screenState === 'ORDER_SETUP' ? (
        <KeyboardAvoidingView
          style={styles.sheetWrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Что везем</Text>

            <TextInput
              style={styles.input}
              placeholder="Описание посылки"
              placeholderTextColor="#71717A"
              value={itemDescription}
              onChangeText={setItemDescription}
            />
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Вес"
                placeholderTextColor="#71717A"
                value={packageWeight}
                onChangeText={setPackageWeight}
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Размер"
                placeholderTextColor="#71717A"
                value={packageSize}
                onChangeText={setPackageSize}
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Комментарий для курьера"
              placeholderTextColor="#71717A"
              value={comment}
              onChangeText={setComment}
            />
            <TextInput
              style={styles.input}
              placeholder="Ваша цена"
              placeholderTextColor="#71717A"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
            />

            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, loading && styles.disabledButton]}
                onPress={() => {
                  resetDraft();
                  changeState('IDLE');
                }}
                disabled={loading}
              >
                <Text style={styles.secondaryButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, loading && styles.disabledButton]} onPress={handleCreateOrder} disabled={loading}>
                {loading ? <ActivityIndicator color="#09090B" /> : <Text style={styles.primaryButtonText}>Заказать</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : null}

      <SearchSheet
        anim={searchSheetAnim}
        mode="route"
        fromAddress={pickupAddress}
        setFromAddress={setPickupAddress}
        toAddress={dropoffAddress}
        setToAddress={setDropoffAddress}
        isStopSelectionMode={false}
        userLocation={userLocation}
        onClose={() => {
          if (dropoffAddress.trim()) {
            changeState('ORDER_SETUP');
          } else {
            changeState('IDLE');
          }
        }}
        onMapPick={(field) => {
          setMapPickTarget(field === 'from' ? 'pickup' : 'dropoff');
          setMapCenter(field === 'from' ? (pickupCoord ?? userLocation) : (dropoffCoord ?? userLocation));
          changeState('MAP_PICK');
        }}
        onSubmit={() => void handleSubmitRoute()}
        onAddressSelect={handleAddressSelect}
      />

      {screenState === 'MAP_PICK' ? (
        <View style={styles.mapConfirm}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={async () => {
              if (!mapCenter) {
                return;
              }

              const address = await reverseGeocodeWithGoogle(mapCenter.lat, mapCenter.lng).catch(() => 'Точка на карте');
              await saveRecentAddress(address, mapCenter.lat, mapCenter.lng);

              if (mapPickTarget === 'pickup') {
                setPickupAddress(address);
                setPickupCoord({ lat: mapCenter.lat, lng: mapCenter.lng });
              } else {
                setDropoffAddress(address);
                setDropoffCoord({ lat: mapCenter.lat, lng: mapCenter.lng });
              }

              if (mapPickTarget === 'pickup' && !dropoffAddress.trim()) {
                changeState('SEARCH');
                return;
              }

              changeState('ORDER_SETUP');
            }}
          >
            <Text style={styles.primaryButtonText}>Готово</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  backBtn: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: '#18181B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    zIndex: 10,
  },
  backBtnText: { color: '#F4F4F5', fontSize: 14, fontWeight: '700' },
  searchCard: {
    position: 'absolute',
    top: 115,
    left: 16,
    right: 16,
    backgroundColor: '#18181B',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  row: { flexDirection: 'row', alignItems: 'center', height: 44 },
  dot: { width: 8, height: 8, borderRadius: 999, marginRight: 14 },
  divider: { height: 1, backgroundColor: '#27272A', marginLeft: 22, marginVertical: 4 },
  addressText: { flex: 1, color: '#F4F4F5', fontSize: 16, fontWeight: '600' },
  placeholderText: { flex: 1, color: '#71717A', fontSize: 16 },
  activeOrderBanner: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 120,
    backgroundColor: '#F59E0B',
    borderRadius: 18,
    padding: 16,
  },
  activeOrderTitle: { color: '#09090B', fontSize: 16, fontWeight: '900', marginBottom: 4 },
  activeOrderSubtext: { color: '#3F2B05', fontSize: 13, fontWeight: '700' },
  sheetWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: '#09090B',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 20,
    paddingBottom: 32,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#27272A',
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetTitle: { color: '#F4F4F5', fontSize: 20, fontWeight: '900', marginBottom: 14 },
  input: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 16,
    color: '#F4F4F5',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  inputRow: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },
  buttonsRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  primaryButton: {
    flex: 1,
    backgroundColor: '#F4F4F5',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primaryButtonText: { color: '#09090B', fontSize: 16, fontWeight: '900' },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#18181B',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  secondaryButtonText: { color: '#F4F4F5', fontSize: 16, fontWeight: '800' },
  disabledButton: { opacity: 0.6 },
  centerPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -11,
  },
  centerPin: {
    width: 22,
    height: 22,
    backgroundColor: '#F4F4F5',
    borderRadius: 11,
    borderBottomLeftRadius: 0,
    transform: [{ rotate: '45deg' }],
    borderWidth: 4,
    borderColor: '#09090B',
  },
  mapConfirm: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 40,
  },
});
