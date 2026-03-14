import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Dimensions, KeyboardAvoidingView, Platform, Animated, Pressable, ScrollView, FlatList, Keyboard } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient, setAuthToken } from '../../api/client';
import { clearAuth } from '../../storage/authStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'PassengerHome'>;
const { width, height } = Dimensions.get('window');

const RECENT_PLACES = [
  { id: '1', name: 'Центральный рынок', address: 'ул. Тауелсыздык', lat: 46.1745, lng: 80.9312 },
  { id: '2', name: 'Районная больница', address: 'ул. Абая', lat: 46.1620, lng: 80.9405 },
  { id: '3', name: 'ЖД Вокзал', address: 'Ушарал-1', lat: 46.1850, lng: 80.9120 },
];

export const PassengerHomeScreen: React.FC<Props> = ({ navigation, route }) => {
  // --- СОСТОЯНИЯ ---
  const [fromAddress, setFromAddress] = useState('Определяем адрес...');
  const [toAddress, setToAddress] = useState('');
  const [fromCoord, setFromCoord] = useState<{latitude: number, longitude: number} | null>(null);
  const [toCoord, setToCoord] = useState<{latitude: number, longitude: number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeField, setActiveField] = useState<'from' | 'to'>('from');
  const [profile, setProfile] = useState<{fullName: string, phone: string} | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isSearching, setIsSearching] = useState(false); 
  const [isRouteSelected, setIsRouteSelected] = useState(false);
  
  const menuAnim = useRef(new Animated.Value(width)).current; 
  const webViewRef = useRef<WebView>(null);

  // --- ФУНКЦИИ ---
  const sendToMap = (command: any) => {
    webViewRef.current?.injectJavaScript(`window.handleAppMessage(${JSON.stringify(command)})`);
  };

  const handleLogout = async () => { 
    await clearAuth(); 
    setAuthToken(null); 
    navigation.replace('Login'); 
  };

  const toggleMenu = (open: boolean) => {
    if (open) { Keyboard.dismiss(); setIsSearching(false); fetchProfile(); }
    setShowMenu(open);
    Animated.timing(menuAnim, { toValue: open ? width * 0.2 : width, duration: 300, useNativeDriver: true }).start();
  };

  const fetchProfile = async () => {
    try {
      const res = await apiClient.get('/users/me'); 
      setProfile({ fullName: res.data.passenger?.fullName || 'Пользователь', phone: res.data.phone });
    } catch (e) { console.log(e); }
  };

  const reverseGeocode = async (lat: number, lng: number, target: 'from' | 'to') => {
    try {
      const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (result.length > 0) {
        const addr = result[0];
        const formatted = `${addr.street || ''} ${addr.name || ''}`.trim() || 'Ушарал';
        target === 'from' ? setFromAddress(formatted) : setToAddress(formatted);
      }
    } catch (e) { console.log(e); }
  };

  const handleSearchSubmit = async () => {
    if (toAddress.length < 3) return;
    Keyboard.dismiss();
    try {
      const results = await Location.geocodeAsync(toAddress);
      if (results.length > 0) {
        const coords = { latitude: results[0].latitude, longitude: results[0].longitude };
        setToCoord(coords);
        setIsSearching(false);
        setIsRouteSelected(true);
      }
    } catch (e) { alert('Адрес не найден'); }
  };

  const selectPlace = (place: any) => {
    setToAddress(place.name);
    setToCoord({ latitude: place.lat, longitude: place.lng });
    setIsSearching(false);
    setIsRouteSelected(true);
    Keyboard.dismiss();
  };

  const onMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MAP_MOVE_END') {
        const coords = { latitude: data.lat, longitude: data.lng };
        if (activeField === 'from') { setFromCoord(coords); reverseGeocode(data.lat, data.lng, 'from'); }
        else { setToCoord(coords); reverseGeocode(data.lat, data.lng, 'to'); }
      }
    } catch (e) {}
  };

  // --- ЭФФЕКТЫ ---
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setFromCoord(coords);
      reverseGeocode(coords.latitude, coords.longitude, 'from');
      setTimeout(() => sendToMap({ type: 'SET_VIEW', lat: coords.latitude, lng: coords.longitude }), 1000);
    })();
    fetchProfile();
  }, []);

  useEffect(() => {
    if (fromCoord && toCoord && isRouteSelected) {
      sendToMap({ type: 'DRAW_ROUTE', from: [fromCoord.latitude, fromCoord.longitude], to: [toCoord.latitude, toCoord.longitude] });
    } else if (!isRouteSelected) {
      sendToMap({ type: 'CLEAR_ROUTE' });
    }
  }, [fromCoord, toCoord, isRouteSelected]);

  const mapHtml = useMemo(() => `
    <!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>body{margin:0;padding:0;background:#0F172A}#map{height:100vh;width:100vw}.leaflet-control-attribution{display:none}</style>
    </head><body><div id="map"></div><script>
    var map=L.map('map',{zoomControl:false}).setView([46.1663,80.9329],16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
    var markerB=null,routeLine=null;
    window.handleAppMessage=function(d){
      if(d.type==='SET_VIEW')map.flyTo([d.lat,d.lng],17);
      if(d.type==='DRAW_ROUTE'){
        if(routeLine)map.removeLayer(routeLine);if(markerB)map.removeLayer(markerB);
        markerB=L.marker(d.to).addTo(map);
        routeLine=L.polyline([d.from,d.to],{color:'#3B82F6',weight:5}).addTo(map);
        map.fitBounds(routeLine.getBounds(),{padding:[100,100]});
      }
      if(d.type==='CLEAR_ROUTE'){if(routeLine)map.removeLayer(routeLine);if(markerB)map.removeLayer(markerB);routeLine=null;markerB=null;}
    };
    map.on('moveend',function(){var c=map.getCenter();window.ReactNativeWebView.postMessage(JSON.stringify({type:'MAP_MOVE_END',lat:c.lat,lng:c.lng}));});
    </script></body></html>
  `, []);

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <WebView ref={webViewRef} originWhitelist={['*']} source={{ html: mapHtml }} style={styles.map} onMessage={onMessage} />
        {!isRouteSelected && (
          <View style={styles.pinContainer} pointerEvents="none">
            <View style={styles.pinCircle}><View style={styles.pinDot}/></View><View style={styles.pinLeg}/>
          </View>
        )}
        <TouchableOpacity style={[styles.locationBtn, isRouteSelected && {bottom: 380}]} onPress={() => sendToMap({ type: 'SET_VIEW', lat: fromCoord?.latitude, lng: fromCoord?.longitude })}>
          <Text style={{fontSize: 20}}>🎯</Text>
        </TouchableOpacity>
      </View>

      {/* ПОИСК */}
      {!isSearching && !isRouteSelected && (
        <View style={styles.topInterface}>
          <View style={styles.searchCard}>
            <View style={styles.searchHeader}>
              <View style={{flex: 1}}>
                <TouchableOpacity onPress={() => { setIsSearching(true); setActiveField('from'); }} style={styles.searchRow}>
                  <View style={[styles.dot, {backgroundColor: '#3B82F6'}]} /><Text style={styles.topInputText} numberOfLines={1}>{fromAddress}</Text>
                </TouchableOpacity>
                <View style={styles.line} />
                <TouchableOpacity onPress={() => { setIsSearching(true); setActiveField('to'); }} style={styles.searchRow}>
                  <View style={[styles.dot, {backgroundColor: '#EF4444'}]} /><Text style={[styles.topInputText, !toAddress && {color: '#64748B'}]} numberOfLines={1}>{toAddress || 'Куда поедете?'}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.profileBtn} onPress={() => toggleMenu(true)}><Text style={{fontSize: 24}}>👤</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ОВЕРЛЕЙ ПОИСКА */}
      {isSearching && (
        <View style={styles.searchOverlay}>
          <View style={styles.searchHeaderFull}>
            <TouchableOpacity onPress={() => { setIsSearching(false); Keyboard.dismiss(); }}><Text style={{fontSize: 24}}>←</Text></TouchableOpacity>
            <TextInput style={styles.inputFull} placeholder="Куда поедете?" value={toAddress} onChangeText={setToAddress} autoFocus returnKeyType="done" onSubmitEditing={handleSearchSubmit} />
            <TouchableOpacity onPress={() => { setIsSearching(false); Keyboard.dismiss(); }}><Text style={{color: '#3B82F6', fontWeight: 'bold'}}>Карта</Text></TouchableOpacity>
          </View>
          <FlatList data={RECENT_PLACES} keyExtractor={(item) => item.id} renderItem={({ item }) => (
            <TouchableOpacity style={styles.historyItem} onPress={() => selectPlace(item)}>
              <View style={styles.historyIcon}><Text>🕒</Text></View>
              <View><Text style={styles.historyName}>{item.name}</Text><Text style={styles.historyAddr}>{item.address}</Text></View>
            </TouchableOpacity>
          )} keyboardShouldPersistTaps="handled" />
        </View>
      )}

      {/* МЕНЮ ЗАКАЗА */}
      {isRouteSelected && (
        <View style={styles.confirmSheet}>
          <TouchableOpacity style={{alignItems: 'center', marginBottom: 10}} onPress={() => setIsRouteSelected(false)}><View style={styles.handle}/></TouchableOpacity>
          <View style={styles.addressBlock}>
            <Text style={styles.addressText} numberOfLines={1}>● {fromAddress}</Text>
            <Text style={styles.addressText} numberOfLines={1}>■ {toAddress}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 20}}>
            <TouchableOpacity style={[styles.tariffCard, styles.tariffActive]}><Text style={{fontSize: 30}}>🚕</Text><Text style={styles.tariffName}>UberX</Text><Text>550 ₸</Text></TouchableOpacity>
            <TouchableOpacity style={styles.tariffCard}><Text style={{fontSize: 30}}>✨</Text><Text style={styles.tariffName}>Comfort</Text><Text>800 ₸</Text></TouchableOpacity>
          </ScrollView>
          <TouchableOpacity style={styles.mainConfirmBtn} onPress={() => navigation.navigate('RideStatus', { rideId: 'test' })}><Text style={styles.mainConfirmBtnText}>ЗАКАЗАТЬ</Text></TouchableOpacity>
        </View>
      )}

      {/* БОКОВОЕ МЕНЮ */}
      {showMenu && <Pressable style={styles.overlay} onPress={() => toggleMenu(false)} />}
      <Animated.View style={[styles.sideMenu, { transform: [{ translateX: menuAnim }] }]}>
        <View style={styles.menuHeader}><Text style={styles.userName}>{profile?.fullName || 'Загрузка...'}</Text><Text style={styles.userPhone}>{profile?.phone || ''}</Text></View>
        <ScrollView style={{padding: 20}}>
          <TouchableOpacity style={styles.menuItem} onPress={() => { toggleMenu(false); navigation.navigate('RideHistory'); }}><Text style={styles.menuItemText}>История заказов</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.menuItem, {marginTop: 20}]} onPress={handleLogout}><Text style={[styles.menuItemText, {color: '#EF4444'}]}>Выйти</Text></TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  mapContainer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  map: { flex: 1 },
  pinContainer: { position: 'absolute', top: '50%', left: '50%', marginLeft: -12, marginTop: -34, alignItems: 'center', justifyContent: 'center', width: 24, height: 36, zIndex: 10 },
  pinCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
  pinDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#EF4444' },
  pinLeg: { width: 1.5, height: 12, backgroundColor: '#EF4444' },
  locationBtn: { position: 'absolute', bottom: 40, right: 20, width: 50, height: 50, backgroundColor: 'white', borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 5, zIndex: 10 },
  topInterface: { position: 'absolute', top: 60, left: 20, right: 20, zIndex: 100 },
  searchCard: { backgroundColor: 'white', borderRadius: 15, padding: 15, elevation: 10 },
  searchHeader: { flexDirection: 'row', alignItems: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', height: 40 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 15 },
  topInputText: { flex: 1, color: '#1E293B', fontSize: 16 },
  line: { height: 1, backgroundColor: '#F1F5F9', marginLeft: 25, marginVertical: 5 },
  profileBtn: { marginLeft: 15 },
  searchOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'white', zIndex: 300, paddingTop: 50 },
  searchHeaderFull: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  inputFull: { flex: 1, height: 45, backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 15, marginHorizontal: 10, fontSize: 16, color: 'black' },
  historyItem: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  historyIcon: { width: 36, height: 36, backgroundColor: '#F1F5F9', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  historyName: { fontSize: 16, color: '#1E293B', fontWeight: '600' },
  historyAddr: { fontSize: 13, color: '#94A3B8' },
  confirmSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, zIndex: 150, elevation: 20 },
  handle: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3 },
  addressBlock: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 15, marginBottom: 15 },
  addressText: { fontSize: 15, color: '#1E293B', marginBottom: 5 },
  tariffCard: { width: 100, height: 100, backgroundColor: '#F8FAFC', borderRadius: 15, padding: 10, marginRight: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  tariffActive: { borderColor: '#000' },
  tariffName: { fontSize: 12, fontWeight: 'bold' },
  mainConfirmBtn: { height: 60, backgroundColor: 'black', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  mainConfirmBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 500 },
  sideMenu: { position: 'absolute', top: 0, right: 0, width: width * 0.8, height: '100%', backgroundColor: 'white', zIndex: 1000 },
  menuHeader: { backgroundColor: '#1E293B', padding: 30, paddingTop: 60 },
  userName: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  userPhone: { color: '#94A3B8', fontSize: 14 },
  menuItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  menuItemText: { fontSize: 16, color: '#1E293B' },
});