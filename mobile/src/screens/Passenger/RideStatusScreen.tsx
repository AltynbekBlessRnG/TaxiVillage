import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createRidesSocket } from '../../api/socket';
import { loadAuth } from '../../storage/authStorage';
import { ChatScreen } from '../../components/Chat/ChatScreen';
import { RideCompletionModal } from '../../components/RideCompletionModal';
import { sendLocalNotification } from '../../utils/notifications';

type Props = NativeStackScreenProps<RootStackParamList, 'RideStatus'>;

interface RideData {
  id: string;
  status: string;
  fromAddress: string;
  toAddress: string;
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
  comment?: string;
  stops?: Array<{ address: string; lat: number; lng: number }>;
  estimatedPrice?: number;
  finalPrice?: number;
  driver?: {
    id: string;
    fullName: string;
    phone: string;
    lat?: number;
    lng?: number;
    car?: { brand: string; model: string; color: string; plateNumber: string; };
  };
}

export const RideStatusScreen: React.FC<Props> = ({ route, navigation }) => {
  const { rideId } = route.params;
  const [status, setStatus] = useState<string>('');
  const [ride, setRide] = useState<RideData | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    let isMounted = true;
    let socket: any = null;

    const init = async () => {
      try {
        const auth = await loadAuth();
        if (auth?.userId) setCurrentUserId(auth.userId);
        
        const response = await apiClient.get(`/rides/${rideId}`);
        if (!isMounted) return;
        
        const data = response.data;
        setRide(data);
        setStatus(data.status);
        if (data.driver?.lat && data.driver?.lng) {
          setDriverLocation({ lat: data.driver.lat, lng: data.driver.lng });
        }

        // Инициализируем карту, если есть координаты
        if (data.fromLat && data.fromLng && data.toLat && data.toLng && webViewRef.current) {
          setTimeout(() => {
            webViewRef.current?.injectJavaScript(`window.initRide(${data.fromLat}, ${data.fromLng}, ${data.toLat}, ${data.toLng}); true;`);
          }, 1000);
        }

        if (!auth?.accessToken) return;

        socket = createRidesSocket(auth.accessToken);
        socket.emit('join:ride', rideId);
        
        socket.on('ride:updated', (updatedRide: RideData) => {
          if (isMounted && updatedRide.id === rideId) {
            setRide(updatedRide);
            setStatus(updatedRide.status);
            
            if (updatedRide.status === 'COMPLETED' && !showCompletionModal) {
              sendLocalNotification('Поездка завершена', `К оплате: ${updatedRide.finalPrice || updatedRide.estimatedPrice} ₸`);
              setShowCompletionModal(true);
            }
          }
        });

        socket.on('driver:moved', (data: { rideId: string; lat: number; lng: number }) => {
          if (isMounted && data.rideId === rideId) {
            setDriverLocation({ lat: data.lat, lng: data.lng });
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(`window.updateDriver(${data.lat}, ${data.lng}); true;`);
            }
          }
        });

      } catch {}
    };

    init();
    return () => { isMounted = false; socket?.disconnect(); };
  }, [rideId]);

const handleCancel = async () => {
    Alert.alert('Отмена', 'Вы уверены, что хотите отменить поездку?', [
      { text: 'Нет', style: 'cancel' },
      { text: 'Да', style: 'destructive', onPress: async () => {
          try {
            await apiClient.post(`/rides/${rideId}/cancel`);
            navigation.replace('PassengerHome', {});
          } catch (e: any) {
            Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось отменить заказ');
          }
        }
      }
    ]);
  };

  const mapHtml = useMemo(() => `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><style>body{margin:0;padding:0;background:#000}#map{height:100vh;width:100vw}.driver-dot{width:20px;height:20px;background:#F59E0B;border:3px solid #fff;border-radius:50%;box-shadow:0 0 15px #F59E0B}.pin-blue{width:14px;height:14px;background:#3B82F6;border:2px solid #fff;border-radius:50%}.pin-red{width:14px;height:14px;background:#EF4444;border:2px solid #fff;border-radius:50%}</style></head><body><div id="map"></div><script>var map=L.map('map',{zoomControl:false}).setView([43.2389, 76.8897], 13);L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);var driverMarker=null;var routeLine=null;window.initRide=function(fLat,fLng,tLat,tLng){L.marker([fLat,fLng],{icon:L.divIcon({className:'pin-blue',iconSize:[14,14]})}).addTo(map);L.marker([tLat,tLng],{icon:L.divIcon({className:'pin-red',iconSize:[14,14]})}).addTo(map);routeLine=L.polyline([[fLat,fLng],[tLat,tLng]],{color:'#3B82F6',weight:3,dashArray:'5, 10'}).addTo(map);map.fitBounds(routeLine.getBounds(),{padding:[50,50]});};window.updateDriver=function(lat,lng){if(driverMarker)map.removeLayer(driverMarker);driverMarker=L.marker([lat,lng],{icon:L.divIcon({className:'driver-dot',iconSize:[20,20]})}).addTo(map);};</script></body></html>
  `, []);

  const canCancel = status === 'SEARCHING_DRIVER' || status === 'DRIVER_ASSIGNED';
  const price = ride?.finalPrice || ride?.estimatedPrice || 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* КАРТА */}
      <View style={styles.mapWrap}>
        <WebView ref={webViewRef} source={{ html: mapHtml }} style={StyleSheet.absoluteFillObject} scrollEnabled={false} />
      </View>

      {/* КНОПКА НАЗАД (Плавающая) */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.replace('PassengerHome', {})}>
        <Text style={styles.backBtnText}>← На главную</Text>
      </TouchableOpacity>

      {/* ШТОРКА СТАТУСА */}
      <View style={styles.bottomSheet}>
        <View style={styles.handleBar} />

        {/* СТАТУС */}
        <View style={styles.statusHeader}>
          <View style={[styles.statusDot, getStatusDotColor(status)]} />
          <Text style={styles.statusTitle}>{translateStatus(status)}</Text>
        </View>

        {/* ВОДИТЕЛЬ */}
        {ride?.driver && (
          <View style={styles.card}>
            <View style={styles.driverRow}>
              <View>
                <Text style={styles.driverName}>{ride.driver.fullName || 'Водитель'}</Text>
                <Text style={styles.carInfo}>{ride.driver.car?.brand} {ride.driver.car?.model} • {ride.driver.car?.color}</Text>
              </View>
              <View style={styles.plateBox}>
                <Text style={styles.plateText}>{ride.driver.car?.plateNumber}</Text>
              </View>
            </View>
          </View>
        )}

        {/* МАРШРУТ И ЦЕНА */}
        <View style={styles.card}>
          <View style={styles.routePoint}>
            <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
            <Text style={styles.addressText} numberOfLines={1}>{ride?.fromAddress}</Text>
          </View>
          <View style={styles.routePoint}>
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.addressText} numberOfLines={1}>{ride?.toAddress}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Стоимость поездки</Text>
            <Text style={styles.priceValue}>{Math.round(price)} ₸</Text>
          </View>
        </View>

        {/* КНОПКИ */}
        <View style={styles.buttonsRow}>
          {canCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>Отменить</Text>
            </TouchableOpacity>
          )}
          
          {ride?.driver && (
            <TouchableOpacity style={styles.chatBtn} onPress={() => setShowChat(true)}>
              <Text style={styles.chatBtnText}>Чат с водителем</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* МОДАЛКИ */}
      <RideCompletionModal
        visible={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        rideId={rideId}
        finalPrice={price}
        driverName={ride?.driver?.fullName || 'Водитель'}
        onRatingSubmitted={() => navigation.replace('PassengerHome', {})}
      />

      <ChatScreen
        visible={showChat}
        onClose={() => setShowChat(false)}
        rideId={rideId}
        currentUserId={currentUserId}
        userType="PASSENGER"
        receiverName={ride?.driver?.fullName || 'Водитель'}
      />
    </View>
  );
};

function getStatusDotColor(status: string) {
  switch (status) {
    case 'COMPLETED': return { backgroundColor: '#10B981' };
    case 'CANCELED': return { backgroundColor: '#EF4444' };
    case 'IN_PROGRESS': case 'ON_THE_WAY': return { backgroundColor: '#3B82F6' };
    case 'DRIVER_ASSIGNED': return { backgroundColor: '#F59E0B' };
    default: return { backgroundColor: '#71717A' };
  }
}

function translateStatus(status: string): string {
  const t: Record<string, string> = {
    'SEARCHING_DRIVER': 'Ищем водителя...',
    'DRIVER_ASSIGNED': 'Водитель найден',
    'ON_THE_WAY': 'Водитель в пути',
    'IN_PROGRESS': 'В поездке',
    'COMPLETED': 'Поездка завершена',
    'CANCELED': 'Отменена',
  };
  return t[status] || status;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  mapWrap: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  
  backBtn: { position: 'absolute', top: 50, left: 20, backgroundColor: '#18181B', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#27272A', zIndex: 10 },
  backBtnText: { color: '#F4F4F5', fontSize: 14, fontWeight: '600' },

  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#09090B', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: '#27272A' },
  handleBar: { width: 40, height: 4, backgroundColor: '#27272A', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  
  statusHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  statusTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },

  card: { backgroundColor: '#18181B', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#27272A' },
  
  driverRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  driverName: { color: '#F4F4F5', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  carInfo: { color: '#A1A1AA', fontSize: 14, fontWeight: '500' },
  plateBox: { backgroundColor: '#27272A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  plateText: { color: '#F4F4F5', fontSize: 14, fontWeight: '700', textTransform: 'uppercase' },

  routePoint: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  addressText: { color: '#E4E4E7', fontSize: 15, fontWeight: '500', flex: 1 },
  
  divider: { height: 1, backgroundColor: '#27272A', marginVertical: 12 },
  
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { color: '#A1A1AA', fontSize: 14, fontWeight: '500' },
  priceValue: { color: '#3B82F6', fontSize: 22, fontWeight: '800' },

  buttonsRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  cancelBtn: { flex: 1, backgroundColor: '#1C1C1E', paddingVertical: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#27272A' },
  cancelBtnText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  chatBtn: { flex: 2, backgroundColor: '#F4F4F5', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  chatBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
});
