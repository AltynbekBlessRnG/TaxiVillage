import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert } from 'react-native';
import MapView, { Marker, Polyline, type LatLng } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';

// Dark map style for Google Maps
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#64779e' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#334e87' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#0F172A' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#3B82F6' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
];

type Props = NativeStackScreenProps<RootStackParamList, 'DriverRide'>;

export const DriverRideScreen: React.FC<Props> = ({ route, navigation }) => {
  const { rideId } = route.params;
  const [status, setStatus] = useState<string>('');
  const [fromCoord, setFromCoord] = useState<LatLng | null>(null);
  const [toCoord, setToCoord] = useState<LatLng | null>(null);
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [finalPrice, setFinalPrice] = useState<string>('');
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    const fetchRide = async () => {
      try {
        const response = await apiClient.get(`/rides/${rideId}`);
        setStatus(response.data.status);
        setEstimatedPrice(response.data.estimatedPrice || 0);
        const fromLat: number = response.data.fromLat;
        const fromLng: number = response.data.fromLng;
        const toLat: number = response.data.toLat;
        const toLng: number = response.data.toLng;
        const hasFrom = Number.isFinite(fromLat) && Number.isFinite(fromLng) && (fromLat !== 0 || fromLng !== 0);
        const hasTo = Number.isFinite(toLat) && Number.isFinite(toLng) && (toLat !== 0 || toLng !== 0);
        setFromCoord(hasFrom ? { latitude: fromLat, longitude: fromLng } : null);
        setToCoord(hasTo ? { latitude: toLat, longitude: toLng } : null);
      } catch {
        // ignore
      }
    };
    fetchRide();
  }, [rideId]);

  useEffect(() => {
    if (!mapRef.current || !fromCoord || !toCoord) return;
    mapRef.current.fitToCoordinates([fromCoord, toCoord], {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: true,
    });
  }, [fromCoord, toCoord]);

  const initialRegion = useMemo(() => {
    const base = fromCoord ?? toCoord;
    if (!base) return undefined;
    return {
      latitude: base.latitude,
      longitude: base.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }, [fromCoord, toCoord]);

  const updateStatus = async (newStatus: string) => {
    try {
      if (newStatus === 'COMPLETED') {
        // Show price input modal
        setShowPriceInput(true);
        return;
      }
      
      await apiClient.post(`/rides/${rideId}/status`, { status: newStatus });
      setStatus(newStatus);
    } catch {
      // ignore
    }
  };

  const completeRide = async () => {
    try {
      const price = parseFloat(finalPrice) || estimatedPrice;
      await apiClient.post(`/rides/${rideId}/complete`, { finalPrice: price });
      setStatus('COMPLETED');
      setShowPriceInput(false);
      navigation.replace('DriverHome');
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      {/* Map as full background */}
      <View style={styles.mapWrap}>
        {initialRegion ? (
          <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion} customMapStyle={darkMapStyle}>
            {fromCoord && <Marker coordinate={fromCoord} title="A" pinColor="#10B981" />}
            {toCoord && <Marker coordinate={toCoord} title="B" pinColor="#3B82F6" />}
            {fromCoord && toCoord && (
              <Polyline coordinates={[fromCoord, toCoord]} strokeWidth={4} strokeColor="#3B82F6" />
            )}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>Координаты недоступны</Text>
          </View>
        )}
      </View>

      {/* Floating Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.handleBar} />
        
        <Text style={styles.title}>Текущая поездка</Text>
        
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Статус</Text>
          <Text style={styles.statusValue}>{status}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.actionButton, styles.onTheWayButton]}
            onPress={() => updateStatus('ON_THE_WAY')}
          >
            <Text style={styles.actionButtonText}>Еду к клиенту</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.inProgressButton]}
            onPress={() => updateStatus('IN_PROGRESS')}
          >
            <Text style={styles.actionButtonText}>Везу клиента</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => updateStatus('COMPLETED')}
          >
            <Text style={styles.completeButtonText}>Завершить поездку</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Price Input Modal */}
      <Modal
        visible={showPriceInput}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPriceInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Завершить поездку</Text>
            <Text style={styles.modalSubtitle}>Укажите финальную стоимость поездки</Text>
            
            <TextInput
              style={styles.priceInput}
              value={finalPrice}
              onChangeText={setFinalPrice}
              placeholder={`${estimatedPrice} ₽`}
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              autoFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowPriceInput(false)}
              >
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={completeRide}
              >
                <Text style={styles.confirmButtonText}>Завершить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  mapWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    backgroundColor: '#0F172A',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  mapPlaceholderText: {
    color: '#64748B',
    fontSize: 16,
  },
  // Floating Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    borderWidth: 1,
    borderColor: '#334155',
    borderBottomWidth: 0,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#475569',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 16,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  statusLabel: {
    color: '#94A3B8',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statusValue: {
    color: '#3B82F6',
    fontSize: 18,
    fontWeight: '700',
  },
  buttonGroup: {
    gap: 12,
  },
  actionButton: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  onTheWayButton: {
    backgroundColor: '#F59E0B',
  },
  inProgressButton: {
    backgroundColor: '#3B82F6',
  },
  completeButton: {
    backgroundColor: '#10B981',
  },
  completeButtonText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    minWidth: 300,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 24,
    textAlign: 'center',
  },
  priceInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    minWidth: 150,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    minWidth: 100,
  },
  cancelButton: {
    backgroundColor: '#374151',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#10B981',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

