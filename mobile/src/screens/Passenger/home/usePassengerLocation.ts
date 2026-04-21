import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { apiClient } from '../../../api/client';

type UserProfile = { fullName?: string; phone?: string; avatarUrl?: string | null } | null;
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

  const refreshProfile = useCallback(async () => {
    try {
      const res = await apiClient.get('/users/me');
      setUserProfile({
        fullName: res.data.passenger?.fullName,
        phone: res.data.phone,
        avatarUrl: res.data.avatarUrl ?? null,
      });
    } catch {
      setUserProfile({ fullName: 'Пользователь', phone: '', avatarUrl: null });
    } finally {
      setProfileReady(true);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await refreshProfile();
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
  }, [refreshProfile]);

  return {
    userProfile,
    refreshProfile,
    profileReady,
    userLocation,
    setUserLocation,
    mapCenter,
    setMapCenter,
  };
}
