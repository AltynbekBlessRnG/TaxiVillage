import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { apiClient } from '../../../api/client';

type UserProfile = { fullName?: string; phone?: string } | null;
type Coord = { lat: number; lng: number } | null;

export function usePassengerLocation(params: {
  onResolvedCurrentLocation?: (coords: { lat: number; lng: number }) => Promise<void> | void;
}) {
  const { onResolvedCurrentLocation } = params;
  const onResolvedCurrentLocationRef = useRef(onResolvedCurrentLocation);
  const [userProfile, setUserProfile] = useState<UserProfile>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [userLocation, setUserLocation] = useState<Coord>(null);
  const [mapCenter, setMapCenter] = useState<Coord>(null);

  useEffect(() => {
    onResolvedCurrentLocationRef.current = onResolvedCurrentLocation;
  }, [onResolvedCurrentLocation]);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await apiClient.get('/users/me');
        setUserProfile({
          fullName: res.data.passenger?.fullName,
          phone: res.data.phone,
        });
      } catch {
        setUserProfile({ fullName: 'Пользователь', phone: '' });
      } finally {
        setProfileReady(true);
      }

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
      setMapCenter(coords);
      await onResolvedCurrentLocationRef.current?.(coords);
    };

    init().catch(() => {});
  }, []);

  return {
    userProfile,
    profileReady,
    userLocation,
    setUserLocation,
    mapCenter,
    setMapCenter,
  };
}
