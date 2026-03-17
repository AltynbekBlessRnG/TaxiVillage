import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverRide'>;

interface RideDetails {
  fromAddress: string;
  toAddress: string;
  comment?: string;
  stops?: Array<{ address: string }>;
}

export const DriverRideScreen: React.FC<Props> = ({ route, navigation }) => {
  const { rideId } = route.params;
  const [status, setStatus] = useState<string>('');
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);
  const [rideDetails, setRideDetails] = useState<RideDetails | null>(null);
  
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [finalPrice, setFinalPrice] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    const fetchRide = async () => {
      try {
        const response = await apiClient.get(`/rides/${rideId}`);
        const data = response.data;
        
        setStatus(data.status);
        setEstimatedPrice(data.estimatedPrice || 0);
        setRideDetails({
          fromAddress: data.fromAddress,
          toAddress: data.toAddress,
          comment: data.comment,
          stops: data.stops || []
        });
        
        const fromLat = data.fromLat;
        const fromLng = data.fromLng;
        const toLat = data.toLat;
        const toLng = data.toLng;

        if (fromLat && fromLng && toLat && toLng && webViewRef.current) {
          setTimeout(() => {
            webViewRef.current?.injectJavaScript(`window.initRide(${fromLat}, ${fromLng}, ${toLat}, ${toLng}); true;`);
          }, 1000);
        }
      } catch (e: any) {
        Alert.alert('Ошибка', 'Не удалось загрузить данные поездки');
      }
    };
    fetchRide();

    let locationSub: any;
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 20 },
      (pos) => {
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`window.updateDriver(${pos.coords.latitude}, ${pos.coords.longitude}); true;`);
        }
      }
    ).then(sub => locationSub = sub);

    return () => { if (locationSub) locationSub.remove(); };
  }, [rideId]);

  const updateStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      if (newStatus === 'COMPLETED') {
        setShowPriceInput(true);
        setLoading(false);
        return;
      }
      await apiClient.post(`/rides/${rideId}/status`, { status: newStatus });
      setStatus(newStatus);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось обновить статус');
    } finally {
      setLoading(false);
    }
  };

  const completeRide = async () => {
    setLoading(true);
    try {
      const price = parseFloat(finalPrice) || estimatedPrice;
      await apiClient.post(`/rides/${rideId}/complete`, { finalPrice: price });
      setStatus('COMPLETED');
      setShowPriceInput(false);
      navigation.replace('DriverHome');
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось завершить поездку');
    } finally {
      setLoading(false);
    }
  };

  const cancelRide = () => {
    Alert.alert(
      'Отмена заказа',
      'Вы уверены, что хотите отменить этот заказ?',
      [
        { text: 'Нет', style: 'cancel' },
        { 
          text: 'Да, отменить', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await apiClient.post(`/rides/${rideId}/status`, { status: 'CANCELED' });
              navigation.replace('DriverHome');
            } catch (e: any) {
              Alert.alert('Ошибка', 'Не удалось отменить заказ');
            }
          }
        }
      ]
    );
  };

  const mapHtml = useMemo(() => `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><style>body{margin:0;padding:0;background:#0F172A}#map{height:100vh;width:100vw}.driver-dot{width:18px;height:18px;background:#3B82F6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 15px #3B82F6}.pin-green{width:16px;height:16px;background:#10B981;border:2px solid #fff;border-radius:50%}.pin-red{width:16px;height:16px;background:#EF4444;border:2px solid #fff;border-radius:50%}</style></head><body><div id="map"></div><script>var map=L.map('map',{zoomControl:false}).setView([43.2389, 76.8897], 13);L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);var driverMarker=null;var routeLine=null;window.initRide=function(fLat,fLng,tLat,tLng){L.marker([fLat,fLng],{icon:L.divIcon({className:'pin-green',iconSize:[16,16]})}).addTo(map);L.marker([tLat,tLng],{icon:L.divIcon({className:'pin-red',iconSize:[16,16]})}).addTo(map);routeLine=L.polyline([[fLat,fLng],[tLat,tLng]],{color:'#3B82F6',weight:4,dashArray:'10, 10'}).addTo(map);map.fitBounds(routeLine.getBounds(),{padding:[50,50]});};window.updateDriver=function(lat,lng){if(driverMarker)map.removeLayer(driverMarker);driverMarker=L.marker([lat,lng],{icon:L.divIcon({className:'driver-dot',iconSize:[18,18]})}).addTo(map);};</script></body></html>
  `, []);

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <WebView ref={webViewRef} source={{ html: mapHtml }} style={StyleSheet.absoluteFillObject} scrollEnabled={false} />
      </View>

      <View style={styles.bottomSheet}>
        <View style={styles.handleBar} />
        
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Заказ: {estimatedPrice} ₸</Text>
            <Text style={styles.statusBadge}>{status}</Text>
          </View>

          {/* ИНФОРМАЦИЯ О МАРШРУТЕ */}
          {rideDetails && (
            <View style={styles.routeCard}>
              <View style={styles.routePoint}>
                <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.routeText}>{rideDetails.fromAddress}</Text>
              </View>
              
              {rideDetails.stops?.map((stop, idx) => (
                <View key={idx} style={styles.routePoint}>
                  <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.routeText}>Заезд: {stop.address}</Text>
                </View>
              ))}

              <View style={styles.routePoint}>
                <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.routeText}>{rideDetails.toAddress}</Text>
              </View>

              {rideDetails.comment ? (
                <View style={styles.commentBox}>
                  <Text style={styles.commentLabel}>Комментарий:</Text>
                  <Text style={styles.commentText}>{rideDetails.comment}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* УМНЫЕ КНОПКИ СТАТУСА */}
          <View style={styles.buttonGroup}>
            {status === 'DRIVER_ASSIGNED' && (
              <TouchableOpacity style={[styles.actionButton, styles.onTheWayButton]} onPress={() => updateStatus('ON_THE_WAY')} disabled={loading}>
                <Text style={styles.actionButtonText}>Еду к клиенту</Text>
              </TouchableOpacity>
            )}

            {status === 'ON_THE_WAY' && (
              <TouchableOpacity style={[styles.actionButton, styles.inProgressButton]} onPress={() => updateStatus('IN_PROGRESS')} disabled={loading}>
                <Text style={styles.actionButtonText}>Клиент в машине (Начать)</Text>
              </TouchableOpacity>
            )}

            {status === 'IN_PROGRESS' && (
              <TouchableOpacity style={[styles.actionButton, styles.completeButton]} onPress={() => updateStatus('COMPLETED')} disabled={loading}>
                <Text style={styles.completeButtonText}>Завершить поездку</Text>
              </TouchableOpacity>
            )}

            {/* Кнопка отмены доступна, пока поездка не началась */}
            {(status === 'DRIVER_ASSIGNED' || status === 'ON_THE_WAY') && (
              <TouchableOpacity style={styles.cancelButton} onPress={cancelRide} disabled={loading}>
                <Text style={styles.cancelButtonText}>Отменить заказ</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>

      {/* МОДАЛКА ЗАВЕРШЕНИЯ */}
      <Modal visible={showPriceInput} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Завершить поездку</Text>
            <Text style={styles.modalSubtitle}>Укажите финальную стоимость поездки</Text>
            <TextInput 
              style={styles.priceInput} 
              value={finalPrice} 
              onChangeText={setFinalPrice} 
              placeholder={`${estimatedPrice} ₸`} 
              placeholderTextColor="#94A3B8" 
              keyboardType="numeric" 
              autoFocus 
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelModalButton]} onPress={() => setShowPriceInput(false)}>
                <Text style={styles.cancelModalButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={completeRide} disabled={loading}>
                <Text style={styles.confirmButtonText}>{loading ? 'Загрузка...' : 'Завершить'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  mapWrap: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1E293B', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34, borderWidth: 1, borderColor: '#334155', borderBottomWidth: 0, maxHeight: '50%' },
  handleBar: { width: 40, height: 4, backgroundColor: '#475569', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  scrollContent: { flexGrow: 0 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#10B981' },
  statusBadge: { backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  
  routeCard: { backgroundColor: '#0F172A', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  routePoint: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  routeText: { color: '#F8FAFC', fontSize: 15, flex: 1 },
  commentBox: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1E293B' },
  commentLabel: { color: '#94A3B8', fontSize: 12, marginBottom: 4 },
  commentText: { color: '#F59E0B', fontSize: 14, fontStyle: 'italic' },

  buttonGroup: { gap: 12 },
  actionButton: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  actionButtonText: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  onTheWayButton: { backgroundColor: '#F59E0B' },
  inProgressButton: { backgroundColor: '#3B82F6' },
  completeButton: { backgroundColor: '#10B981' },
  completeButtonText: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  cancelButton: { paddingVertical: 16, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#7F1D1D' },
  cancelButtonText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#1E293B', borderRadius: 24, padding: 32, alignItems: 'center', minWidth: 300, borderWidth: 1, borderColor: '#334155' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#F8FAFC', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#94A3B8', marginBottom: 24, textAlign: 'center' },
  priceInput: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center', minWidth: 150, marginBottom: 24 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalButton: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center', minWidth: 100 },
  cancelModalButton: { backgroundColor: '#374151' },
  cancelModalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  confirmButton: { backgroundColor: '#10B981' },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});