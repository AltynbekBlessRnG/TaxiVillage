import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Switch, Alert, TouchableOpacity, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, logout } from '../../api/client';
import { createRidesSocket } from '../../api/socket';
import { loadAuth } from '../../storage/authStorage';
import { RideOfferSheet } from '../../components/Driver/RideOfferSheet';
import { DriverSideMenu } from '../../components/Driver/DriverSideMenu';
import { DriverStatusSheet } from '../../components/Driver/DriverStatusSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverHome'>;

interface RideOffer {
  id: string;
  fromAddress: string;
  toAddress: string;
  comment?: string;
  stops?: Array<{ address: string; lat: number; lng: number }>;
  estimatedPrice?: number;
  fromLat: number;
  fromLng: number;
  hasRoute?: boolean;
}

export const DriverHomeScreen: React.FC<Props> = ({ navigation }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState<RideOffer | null>(null);
  const webViewRef = useRef<WebView>(null);

  const toggleOnline = async (value: boolean) => {
    if (value) {
      try {
        await apiClient.post('/drivers/status', { isOnline: value });
        setIsOnline(true);
        const res = await apiClient.get('/drivers/profile');
        setProfile(res.data);
      } catch (e: any) {
        let errorMessage = e?.response?.data?.message || 'Не удалось выйти на линию';
        if (errorMessage.includes('не одобрен')) errorMessage = '⏳ Ваш аккаунт ожидает подтверждения.';
        else if (errorMessage.includes('автомобиле')) errorMessage = '🚗 Заполните информацию об авто в профиле.';
        else if (errorMessage.includes('удостоверения')) errorMessage = '📄 Загрузите фото прав в профиле.';
        
        Alert.alert('Ошибка', errorMessage, [{ text: 'Понятно' }]);
        setIsOnline(false);
      }
    } else {
      setIsOnline(false);
      try { await apiClient.post('/drivers/status', { isOnline: false }); } catch {}
    }
  };

  const handleLogout = async () => {
    if (isOnline) {
      try { await apiClient.post('/drivers/status', { isOnline: false }); } catch {}
    }
    await logout();
    navigation.replace('Login');
  };

  const acceptRide = useCallback(async (rideId: string) => {
    try {
      await apiClient.post(`/rides/${rideId}/accept`);
      setIncomingOffer(null); // Прячем шторку
      setCurrentRideId(rideId);
      // АВТОМАТИЧЕСКИ ПЕРЕХОДИМ НА ЭКРАН ПОЕЗДКИ:
      navigation.navigate('DriverRide', { rideId });
    } catch { Alert.alert('Ошибка', 'Не удалось принять заказ'); }
  }, [navigation]); // Не забудь добавить navigation в зависимости!

  const rejectRide = useCallback(async (rideId: string) => {
    try { await apiClient.post(`/rides/${rideId}/reject`); } catch {}
    setIncomingOffer(null); // Прячем шторку
  }, []);

  useEffect(() => {
    apiClient.get('/drivers/profile').then(res => setProfile(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOnline) { setCurrentRideId(null); return; }

    let socket: any = null;
    let isMounted = true;
    let locationSub: any = null;

    const init = async () => {
      try {
        const auth = await loadAuth();
        if (!isMounted || !auth?.accessToken) return;

        const res = await apiClient.get('/drivers/current-ride');
        if (isMounted && res.data?.id) setCurrentRideId(res.data.id);

        socket = createRidesSocket(auth.accessToken);
        
        socket.on('ride:offer', (ride: RideOffer) => {
          if (!isMounted) return;
          
          // Если водитель офлайн, отбиваем заказ
          if (!isOnline) {
            apiClient.post(`/rides/${ride.id}/reject`).catch(() => {});
            return;
          }
          
          // Просто передаем данные в стейт. Вся отрисовка теперь внутри RideOfferSheet!
          setIncomingOffer(ride);
        });

        socket.on('ride:created', (ride: any) => { if (isMounted) setCurrentRideId(ride.id); });
        socket.on('ride:updated', (ride: any) => {
          if (isMounted) setCurrentRideId((ride.status === 'COMPLETED' || ride.status === 'CANCELED') ? null : ride.id);
        });

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          locationSub = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 50 },
            async (pos) => {
              try {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                setLocation({ lat, lng });
                
                // Обновляем маркер на карте
                if (webViewRef.current) {
                  webViewRef.current.injectJavaScript(`window.setLocation(${lat}, ${lng}); true;`);
                }

                await apiClient.patch('/drivers/location', { lat, lng });
              } catch {}
            }
          );
        }
      } catch {}
    };

    init();
    return () => { isMounted = false; socket?.disconnect(); locationSub?.remove(); };
  }, [isOnline, acceptRide, rejectRide]);

  const recenterMap = () => {
    if (location && webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.recenter(${location.lat}, ${location.lng}); true;`);
    }
  };

  const mapHtml = useMemo(() => `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><style>body{margin:0;padding:0;background:#0F172A}#map{height:100vh;width:100vw}.driver-dot{width:20px;height:20px;background:#3B82F6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 15px #3B82F6}</style></head><body><div id="map"></div><script>var map=L.map('map',{zoomControl:false}).setView([43.2389, 76.8897], 15);L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);var driverMarker = null;window.setLocation = function(lat, lng) { if(driverMarker) map.removeLayer(driverMarker); driverMarker = L.marker([lat, lng], {icon: L.divIcon({className:'driver-dot',iconSize:[20,20]})}).addTo(map); }; window.recenter = function(lat, lng) { map.flyTo([lat, lng], 16); };</script></body></html>
  `, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <View style={styles.mapContainer}>
        <WebView 
          ref={webViewRef} 
          source={{ html: mapHtml }} 
          style={StyleSheet.absoluteFillObject} 
          scrollEnabled={false}
        />
      </View>

      <TouchableOpacity style={styles.burgerBtn} onPress={() => setIsMenuOpen(true)}>
        <Text style={{fontSize: 24, color: '#fff'}}>☰</Text>
      </TouchableOpacity>

      <View style={styles.toggleContainer}>
        <Text style={styles.toggleText}>{isOnline ? 'На линии' : 'Офлайн'}</Text>
        <Switch 
          value={isOnline} 
          onValueChange={toggleOnline} 
          trackColor={{ false: '#475569', true: '#10B981' }} 
          thumbColor="#fff" 
        />
      </View>

      <TouchableOpacity style={styles.recenterBtn} onPress={recenterMap}>
        <Text style={{fontSize: 22}}>🎯</Text>
      </TouchableOpacity>

      {incomingOffer ? (
        <RideOfferSheet 
          offer={incomingOffer} 
          onAccept={acceptRide} 
          onReject={rejectRide} 
        />
      ) : (
        <DriverStatusSheet 
          isOnline={isOnline} 
          currentRideId={currentRideId} 
          profile={profile}
          onGoToRide={() => currentRideId && navigation.navigate('DriverRide', { rideId: currentRideId })} 
        />
      )}

      <DriverSideMenu 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        profile={profile} 
        onNavigate={(screen) => { setIsMenuOpen(false); navigation.navigate(screen as any); }} 
        onLogout={handleLogout} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  mapContainer: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  mapPlaceholderText: { color: '#71717A', fontSize: 16 },
  
  burgerBtn: { position: 'absolute', top: 50, left: 20, width: 46, height: 46, backgroundColor: '#18181B', borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#27272A', zIndex: 10 },
  
  toggleContainer: { position: 'absolute', top: 50, right: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#27272A', zIndex: 10 },
  toggleText: { color: '#F4F4F5', fontSize: 14, fontWeight: '600', marginRight: 10 },
  
  recenterBtn: { position: 'absolute', bottom: 160, right: 20, width: 50, height: 50, backgroundColor: '#18181B', borderRadius: 25, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#27272A', zIndex: 10 },
});
