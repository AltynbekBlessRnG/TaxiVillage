import React, { useMemo, useRef, useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Animated, StatusBar, 
  Dimensions, LayoutAnimation, Keyboard, Alert, ActivityIndicator,Pressable, ScrollView 
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { loadAuth, clearAuth } from '../../storage/authStorage';
import { initializeNotifications, sendLocalNotification, NOTIFICATION_TYPES } from '../../utils/notifications';

// Импортируем наши "забетонированные" компоненты
import { SearchSheet } from '../../components/Passenger/SearchSheet';
import { ConfirmationSheet } from '../../components/Passenger/ConfirmationSheet';
import { SearchingSheet } from '../../components/Passenger/SearchingSheet';
import { OrderDetailsSheet } from '../../components/Passenger/OrderDetailsSheet';
import { createRidesSocket } from '../../api/socket';

const { width, height } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'PassengerHome'>;
type ScreenState = 'IDLE' | 'SEARCH' | 'MAP_PICK' | 'ORDER_SETUP' | 'SEARCHING';

export const PassengerHomeScreen: React.FC<Props> = ({ navigation }) => {
  const [screenState, setScreenState] = useState<ScreenState>('IDLE');
  const [activeService, setActiveService] = useState('Такси');
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<{fullName?: string, phone?: string} | null>(null);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);

  // Адреса и Координаты
  const [fromAddress, setFromAddress] = useState('Определяем адрес...');
  const [toAddress, setToAddress] = useState('');
  const [fromCoord, setFromCoord] = useState<{lat: number, lng: number} | null>(null);
  const [toCoord, setToCoord] = useState<{lat: number, lng: number} | null>(null);
  
  const [offeredPrice, setOfferedPrice] = useState('');
  const [comment, setComment] = useState('');
  const [stops, setStops] = useState<Array<{address: string, lat: number, lng: number}>>([]);
  const [isStopSelectionMode, setIsStopSelectionMode] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<Array<{id: string, lat: number, lng: number, fullName: string}>>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number} | null>(null);

  // Анимации
  const searchSheetAnim = useRef(new Animated.Value(height)).current;
  const orderSheetTranslateY = useRef(new Animated.Value(height)).current; 
  const sideMenuAnim = useRef(new Animated.Value(-width)).current; 
  const menuBackdropOpacity = useRef(new Animated.Value(0)).current;
  const webViewRef = useRef<WebView>(null);

  // ПРОВЕРКА АКТИВНОГО ЗАКАЗА
  useEffect(() => {
    const checkActiveRide = async () => {
      try {
        const res = await apiClient.get('/rides/my');
        const active = res.data.find((r: any) => 
          ['SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(r.status)
        );
        if (active) {
          setActiveRideId(active.id);
        } else {
          setActiveRideId(null);
        }
      } catch (e) { console.log(e); }
    };

    checkActiveRide();
    const unsubscribe = navigation.addListener('focus', () => {
      checkActiveRide();
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await apiClient.get('/users/me');
        setUserProfile({ fullName: res.data.passenger?.fullName, phone: res.data.phone });
      } catch (e) { console.log('Profile load error'); }

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      
      let location = await Location.getCurrentPositionAsync({});
      const coords = { lat: location.coords.latitude, lng: location.coords.longitude };
      
      setUserLocation(coords);
      setFromCoord(coords);
      
      updateAddress(coords.lat, coords.lng, 'from');
      
      setTimeout(() => {
        webViewRef.current?.injectJavaScript(`window.setUserLocation(${coords.lat}, ${coords.lng})`);
      }, 1000);
    };
    init();
  }, []);

  useEffect(() => {
    if (screenState === 'IDLE' && userLocation) {
      fetchNearbyDrivers();
    }
  }, [screenState, userLocation]);

  useEffect(() => {
    if (webViewRef.current && nearbyDrivers.length > 0) {
      webViewRef.current.injectJavaScript(`window.updateDrivers(${JSON.stringify(nearbyDrivers)})`);
    }
  }, [nearbyDrivers]);

  const fetchNearbyDrivers = async () => {
    if (!userLocation) return;
    try {
      const res = await apiClient.get('/drivers/nearby', {
        params: { lat: userLocation.lat, lng: userLocation.lng, radius: 5 }
      });
      setNearbyDrivers(res.data || []);
    } catch (error) {
      console.log('Failed to fetch nearby drivers:', error);
    }
  };

  useEffect(() => {
    let socket: any = null;

    const connectSocket = async () => {
      const auth = await loadAuth();
      if (auth?.token && screenState === 'SEARCHING') {
        socket = createRidesSocket(auth.token);

        socket.on('ride:updated', (updatedRide: any) => {
          if (updatedRide.status === 'DRIVER_ASSIGNED') {
            socket.disconnect();
            navigation.navigate('RideStatus', { rideId: updatedRide.id });
          }
          
          if (updatedRide.status === 'ON_THE_WAY') {
            sendLocalNotification('Водитель в пути', 'Ваш водитель едет к вам', { type: NOTIFICATION_TYPES.DRIVER_ARRIVED, rideId: updatedRide.id });
          }
          
          if (updatedRide.status === 'CANCELED') {
            sendLocalNotification('Поездка отменена', 'Водитель не найден, попробуйте еще раз', { type: 'RIDE_CANCELED', rideId: updatedRide.id });
            Alert.alert("Упс", "Водитель не найден, попробуйте еще раз");
            changeState('IDLE');
          }
        });
      }
    };

    if (screenState === 'SEARCHING') {
      connectSocket();
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [screenState]);

  const updateAddress = async (lat: number, lng: number, field: 'from' | 'to') => {
    try {
      let result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (result.length > 0) {
        let addr = result[0];
        let formatted = `${addr.street || ''} ${addr.name || ''}`.trim();
        
        if (!formatted || formatted.includes('+')) {
          formatted = addr.district || addr.city || addr.subregion || "Точка на карте";
        }

        if (field === 'from') {
            setFromAddress(formatted);
            setFromCoord({ lat, lng });
        } else {
            setToAddress(formatted);
            setToCoord({ lat, lng });
        }
      }
    } catch (e) { console.log(e); }
  };

  const changeState = (newState: ScreenState) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    
    Animated.timing(searchSheetAnim, { 
      toValue: newState === 'SEARCH' ? height * 0.1 : height, 
      duration: 300, useNativeDriver: true 
    }).start();

    if (newState === 'ORDER_SETUP') {
      orderSheetTranslateY.setValue(height);
      Animated.spring(orderSheetTranslateY, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }).start();
    } else {
      Animated.timing(orderSheetTranslateY, { toValue: height, duration: 300, useNativeDriver: true }).start();
    }

    setScreenState(newState);
    Keyboard.dismiss();
  };

  const handleGeocodeAndProceed = async () => {
    if (!toAddress) { Alert.alert("Ошибка", "Введите адрес назначения"); return; }
    setLoading(true);
    try {
      const [f, t] = await Promise.all([
        Location.geocodeAsync(fromAddress).catch(() => []),
        Location.geocodeAsync(toAddress).catch(() => [])
      ]);

      if (f && f.length > 0) setFromCoord({ lat: f[0].latitude, lng: f[0].longitude });
      else setFromCoord(null);

      if (t && t.length > 0) setToCoord({ lat: t[0].latitude, lng: t[0].longitude });
      else setToCoord(null);

      changeState('ORDER_SETUP');
    } catch (e) {
      changeState('ORDER_SETUP'); 
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRide = async () => {
    if (!toAddress) { Alert.alert("Ошибка", "Укажите адрес назначения"); return; }
    setLoading(true);
    try {
      const payload = {
        fromAddress, 
        toAddress,
        fromLat: fromCoord?.lat || 0,
        fromLng: fromCoord?.lng || 0,
        toLat: toCoord?.lat || 0, 
        toLng: toCoord?.lng || 0,
        comment,
        stops: stops.map(stop => ({
          address: stop.address,
          lat: stop.lat || 0,
          lng: stop.lng || 0
        })),
        estimatedPrice: parseFloat(offeredPrice) || 0
      };

      const res = await apiClient.post('/rides', payload);

      if (res.data?.id) {
        setCurrentRideId(res.data.id);
        changeState('SEARCHING');
      }
    } catch (e: any) { 
      const serverMessage = e.response?.data?.message;
      const errorMessage = Array.isArray(serverMessage) ? serverMessage.join(', ') : serverMessage;
      Alert.alert("Ошибка сервера", errorMessage || "Не удалось создать заказ"); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleAddressSelect = (field: 'from' | 'to', address: string, lat: number, lng: number) => {
    if (field === 'from') {
      setFromAddress(address);
      setFromCoord({ lat, lng });
    } else {
      if (isStopSelectionMode) {
        setStops([...stops, { address, lat, lng }]);
        setIsStopSelectionMode(false);
        changeState('ORDER_SETUP');
        return;
      }
      setToAddress(address);
      setToCoord({ lat, lng });
    }
  };

  const handleAddStop = () => {
    setIsStopSelectionMode(true);
    changeState('SEARCH');
  };

  const handleRemoveStop = (indexToRemove: number) => {
    setStops(stops.filter((_, index) => index !== indexToRemove));
  };

  const handleShowDetails = () => {
    setShowOrderDetails(true);
  };

  const toggleMenu = (show: boolean) => {
    if (show) setIsMenuOpen(true);
    Animated.parallel([
      Animated.timing(sideMenuAnim, { toValue: show ? 0 : -width, duration: 300, useNativeDriver: true }),
      Animated.timing(menuBackdropOpacity, { toValue: show ? 1 : 0, duration: 300, useNativeDriver: true })
    ]).start(() => { if (!show) setIsMenuOpen(false); });
  };

  const mapHtml = useMemo(() => `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><style>body{margin:0;padding:0;background:#000}#map{height:100vh;width:100vw}.user-dot{width:18px;height:18px;background:#3B82F6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 15px #3B82F6}.driver-dot{width:16px;height:16px;background:#EF4444;border:2px solid #fff;border-radius:50%;box-shadow:0 0 10px #EF4444}</style></head><body><div id="map"></div><script>var map=L.map('map',{zoomControl:false}).setView([43.2389, 76.8897], 15);L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);var userMarker = null;var driverMarkers = [];window.setUserLocation = function(lat, lng) { if(userMarker) map.removeLayer(userMarker); userMarker = L.marker([lat, lng], {icon: L.divIcon({className:'user-dot',iconSize:[18,18]})}).addTo(map); map.flyTo([lat, lng], 16); };window.updateDrivers = function(drivers) { driverMarkers.forEach(marker => map.removeLayer(marker)); driverMarkers = []; drivers.forEach(function(driver) { var marker = L.marker([driver.lat, driver.lng], {icon: L.divIcon({className:'driver-dot',iconSize:[16,16]})}).addTo(map); driverMarkers.push(marker); }); };map.on('moveend', function(){ var c=map.getCenter(); window.ReactNativeWebView.postMessage(JSON.stringify({lat:c.lat,lng:c.lng})); });</script></body></html>
  `, [nearbyDrivers]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.mapContainer}>
        <WebView 
          ref={webViewRef} 
          source={{ html: mapHtml }} 
          onMessage={(e) => setMapCenter(JSON.parse(e.nativeEvent.data))} 
          style={styles.map} 
        />
        {screenState === 'MAP_PICK' && <View style={styles.centerPinContainer} pointerEvents="none"><View style={styles.ashenPin} /></View>}
      </View>

      <TouchableOpacity style={styles.burgerBtn} onPress={() => toggleMenu(true)}>
        <Text style={{fontSize: 22, color: '#fff'}}>☰</Text>
      </TouchableOpacity>

      {screenState === 'IDLE' && (
        <View style={styles.uiOverlay} pointerEvents="box-none">
          <View style={styles.ashenSearchCard}>
            <TouchableOpacity style={styles.ashenRow} onPress={() => changeState('SEARCH')}>
              <View style={styles.dotBlue} /><Text style={styles.ashenInputText} numberOfLines={1}>{fromAddress}</Text>
            </TouchableOpacity>
            <View style={styles.zincDivider} />
            <TouchableOpacity style={styles.ashenRow} onPress={() => changeState('SEARCH')}>
              <View style={styles.squareRed} /><Text style={toAddress ? styles.ashenInputText : styles.placeholderZinc}>{toAddress || 'Куда едем?'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.recenterBtn} onPress={() => userLocation && webViewRef.current?.injectJavaScript(`window.setUserLocation(${userLocation.lat}, ${userLocation.lng})`)}>
            <Text style={{fontSize: 22}}>🎯</Text>
          </TouchableOpacity>
          
          {/* ПЛАШКА АКТИВНОГО ЗАКАЗА */}
          {activeRideId && (
            <TouchableOpacity 
              style={styles.activeRideBanner} 
              onPress={() => navigation.navigate('RideStatus', { rideId: activeRideId })}
            >
              <View style={styles.dotGreen} />
              <Text style={styles.activeRideText}>У вас есть активная поездка!</Text>
              <Text style={styles.activeRideArrow}>›</Text>
            </TouchableOpacity>
          )}

          <View style={styles.bottomAshenBar}>
            {['Такси', 'Курьер', 'Еда'].map(s => (
              <TouchableOpacity key={s} style={[styles.serviceBtn, activeService === s && styles.serviceBtnActive]} onPress={() => setActiveService(s)}>
                <Text style={{fontSize: 20}}>{s === 'Такси' ? '🚕' : s === 'Курьер' ? '📦' : '🍕'}</Text>
                <Text style={[styles.serviceLabel, activeService === s && {color: '#fff'}]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <SearchSheet 
        anim={searchSheetAnim}
        fromAddress={fromAddress} setFromAddress={setFromAddress}
        toAddress={toAddress} setToAddress={setToAddress}
        isStopSelectionMode={isStopSelectionMode}
        onClose={() => {
          setIsStopSelectionMode(false);
          changeState(toAddress ? 'ORDER_SETUP' : 'IDLE'); 
        }}
        onMapPick={() => changeState('MAP_PICK')}
        onSubmit={handleGeocodeAndProceed}
        onAddressSelect={handleAddressSelect}
      />

      {screenState === 'MAP_PICK' && (
        <View style={styles.confirmMapPick}>
          <TouchableOpacity style={styles.zincMainBtn} onPress={async () => { 
            if(mapCenter) {
              try {
                let result = await Location.reverseGeocodeAsync({ latitude: mapCenter.lat, longitude: mapCenter.lng });
                let addrStr = "Неизвестная улица";
                if (result.length > 0) {
                  let addr = result[0];
                  addrStr = `${addr.street || ''} ${addr.name || ''}`.trim() || "Неизвестная улица";
                }

                if (isStopSelectionMode) {
                  setStops([...stops, { address: addrStr, lat: mapCenter.lat, lng: mapCenter.lng }]);
                  setIsStopSelectionMode(false);
                } else {
                  setToAddress(addrStr);
                  setToCoord({ lat: mapCenter.lat, lng: mapCenter.lng });
                }
              } catch (e) { console.log(e); }
            }
            changeState('ORDER_SETUP'); 
          }}>
            <Text style={styles.zincMainBtnText}>Готово</Text>
          </TouchableOpacity>
        </View>
      )}

      <ConfirmationSheet 
        translateY={orderSheetTranslateY}
        fromAddress={fromAddress} toAddress={toAddress}
        price={offeredPrice} setPrice={setOfferedPrice}
        onOrder={handleCreateRide}
        onEditAddress={() => changeState('SEARCH')}
        onSwipeDown={() => changeState('IDLE')}
        loading={loading}
        comment={comment}
        setComment={setComment}
        stops={stops}
        onAddStop={handleAddStop}
        onRemoveStop={handleRemoveStop}
      />

      {screenState === 'SEARCHING' && (
        <SearchingSheet 
          onCancel={() => changeState('IDLE')} 
          onShowDetails={handleShowDetails}
        />
      )}

      <OrderDetailsSheet
        visible={showOrderDetails}
        onClose={() => setShowOrderDetails(false)}
        fromAddress={fromAddress}
        comment={comment}
        stops={stops}
        toAddress={toAddress}
        price={offeredPrice}
      />

      {isMenuOpen && (
        <Animated.View style={[styles.menuBackdrop, { opacity: menuBackdropOpacity }]}>
          <Pressable style={{flex: 1}} onPress={() => toggleMenu(false)} />
        </Animated.View>
      )}
      <Animated.View style={[styles.sideDrawer, { transform: [{ translateX: sideMenuAnim }] }]}>
        <View style={styles.drawerHeader}>
            <Text style={styles.drName}>{userProfile?.fullName || 'Загрузка...'}</Text>
            <Text style={styles.drPhone}>{userProfile?.phone || ''}</Text>
        </View>
        <ScrollView style={{padding: 20}}>
          <TouchableOpacity style={styles.drawerItem} onPress={() => { toggleMenu(false); navigation.navigate('RideHistory'); }}>
            <Text style={styles.drawerText}>История заказов</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.drawerItem} onPress={() => { toggleMenu(false); navigation.navigate('FavoriteAddresses'); }}>
            <Text style={styles.drawerText}>Мои адреса</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.drawerItem, {marginTop: 20}]} onPress={() => { toggleMenu(false); clearAuth(); navigation.replace('Login'); }}>
            <Text style={[styles.drawerText, {color: '#EF4444'}]}>Выйти</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  mapContainer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  map: { flex: 1 },
  uiOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  burgerBtn: { position: 'absolute', top: 50, left: 20, width: 46, height: 46, backgroundColor: '#18181B', borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#27272A', zIndex: 100 },
  ashenSearchCard: { marginTop: 115, marginHorizontal: 16, backgroundColor: '#18181B', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#27272A', elevation: 15 },
  ashenRow: { flexDirection: 'row', alignItems: 'center', height: 44 },
  ashenInputText: { flex: 1, color: '#F4F4F5', fontSize: 16, fontWeight: '500' },
  placeholderZinc: { color: '#71717A', fontSize: 16 },
  zincDivider: { height: 1, backgroundColor: '#27272A', marginVertical: 4, marginLeft: 28 },
  recenterBtn: { position: 'absolute', bottom: 160, right: 20, width: 50, height: 50, backgroundColor: '#18181B', borderRadius: 25, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#27272A' },
  
  // СТИЛИ ДЛЯ ПЛАШКИ АКТИВНОГО ЗАКАЗА
  activeRideBanner: { position: 'absolute', bottom: 110, left: 20, right: 20, backgroundColor: '#10B981', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', marginRight: 12 },
  activeRideText: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  activeRideArrow: { color: '#fff', fontSize: 24, fontWeight: '300', marginTop: -4 },

  bottomAshenBar: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: '#18181B', borderRadius: 24, flexDirection: 'row', padding: 8, borderWidth: 1, borderColor: '#27272A', justifyContent: 'space-around' },
  serviceBtn: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 16 },
  serviceBtnActive: { backgroundColor: '#27272A' },
  serviceLabel: { color: '#71717A', fontSize: 12, fontWeight: '700', marginTop: 4 },
  confirmMapPick: { position: 'absolute', bottom: 50, left: 20, right: 20, zIndex: 100 },
  zincMainBtn: { backgroundColor: '#F4F4F5', height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  zincMainBtnText: { color: '#000', fontSize: 18, fontWeight: '800' },
  centerPinContainer: { position: 'absolute', top: '50%', left: '50%', marginTop: -40, marginLeft: -11, zIndex: 5 },
  ashenPin: { width: 22, height: 22, backgroundColor: '#fff', borderRadius: 11, borderBottomLeftRadius: 0, transform: [{rotate:'45deg'}], borderWidth: 4, borderColor: '#000' },
  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 900 },
  sideDrawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: width * 0.8, backgroundColor: '#09090B', zIndex: 1000, borderRightWidth: 1, borderColor: '#18181B' },
  drawerHeader: { backgroundColor: '#18181B', padding: 28, paddingTop: 65 },
  drName: { color: '#fff', fontSize: 22, fontWeight: '800' },
  drPhone: { color: '#71717A', fontSize: 15, marginTop: 6 },
  drawerItem: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#18181B' },
  drawerText: { color: '#E4E4E7', fontSize: 17, fontWeight: '500' },
  dotBlue: { width: 8, height: 8, backgroundColor: '#3B82F6', borderRadius: 4, marginRight: 15 },
  squareRed: { width: 8, height: 8, backgroundColor: '#EF4444', marginRight: 15 },
});