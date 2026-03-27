import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../../api/client';
import { loadAuth } from '../../../storage/authStorage';
import { createRidesSocket } from '../../../api/socket';
import { NOTIFICATION_TYPES, sendLocalNotification } from '../../../utils/notifications';
import { buildRouteCoordinates } from '../../../utils/map';
import { resolveRideRoute } from '../../../utils/rideRoute';

const ACTIVE_RIDE_STATUSES = [
  'SEARCHING_DRIVER',
  'DRIVER_ASSIGNED',
  'ON_THE_WAY',
  'DRIVER_ARRIVED',
  'IN_PROGRESS',
] as const;

export function usePassengerRideState(params: {
  onBecameActive?: () => void;
  onReturnedToIdle?: () => void;
}) {
  const { onBecameActive, onReturnedToIdle } = params;
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeRideRoute, setActiveRideRoute] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [socketState, setSocketState] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');

  const clearRideState = useCallback(() => {
    setCurrentRideId(null);
    setActiveRideId(null);
    setActiveRide(null);
    setDriverLocation(null);
    setActiveRideRoute([]);
    setEtaSeconds(null);
  }, []);

  const refreshActiveRide = useCallback(async () => {
    try {
      const res = await apiClient.get('/rides/my');
      const active = res.data.find((ride: any) => ACTIVE_RIDE_STATUSES.includes(ride.status));
      setActiveRideId(active?.id ?? null);
      setCurrentRideId((prev) => (!prev ? active?.id ?? null : active?.id === prev ? prev : active?.id ?? null));

      if (active?.id) {
        const rideRes = await apiClient.get(`/rides/${active.id}`).catch(() => ({ data: active }));
        const fullRide = rideRes.data ?? active;
        setActiveRide(fullRide);
        if (fullRide?.driver?.lat && fullRide?.driver?.lng) {
          setDriverLocation({ lat: fullRide.driver.lat, lng: fullRide.driver.lng });
        }
      } else {
        clearRideState();
      }

      return active ?? null;
    } catch {
      clearRideState();
      return null;
    }
  }, [clearRideState]);

  useEffect(() => {
    let socket: ReturnType<typeof createRidesSocket> | null = null;
    let mounted = true;

    const connectSocket = async () => {
      const auth = await loadAuth();
      if (!mounted || !auth?.accessToken) {
        return;
      }

      socket = createRidesSocket(auth.accessToken);
      socket.on('connect', () => mounted && setSocketState('connected'));
      socket.on('disconnect', () => mounted && setSocketState('disconnected'));
      socket.io.on('reconnect_attempt', () => mounted && setSocketState('reconnecting'));
      socket.io.on('reconnect', () => mounted && setSocketState('connected'));
      socket.on('connect_error', () => mounted && setSocketState('reconnecting'));

      socket.on('ride:updated', async (updatedRide: { id: string; status: string }) => {
        if (!mounted) {
          return;
        }

        if (updatedRide.id === currentRideId || updatedRide.id === activeRideId) {
          if (updatedRide.status === 'DRIVER_ASSIGNED' || updatedRide.status === 'ON_THE_WAY') {
            setCurrentRideId(updatedRide.id);
            setActiveRideId(updatedRide.id);
            await refreshActiveRide();
            onBecameActive?.();
            return;
          }

          if (updatedRide.status === 'DRIVER_ARRIVED') {
            await refreshActiveRide();
            await sendLocalNotification('Водитель приехал', 'Водитель ожидает вас у точки подачи', {
              type: NOTIFICATION_TYPES.DRIVER_ARRIVED,
              rideId: updatedRide.id,
            });
            onBecameActive?.();
            return;
          }

          if (updatedRide.status === 'CANCELED') {
            await sendLocalNotification('Поездка отменена', 'Водитель не найден, попробуйте еще раз', {
              type: 'RIDE_CANCELED',
              rideId: updatedRide.id,
            });
            clearRideState();
            onReturnedToIdle?.();
            return;
          }

          if (updatedRide.status === 'COMPLETED') {
            clearRideState();
            onReturnedToIdle?.();
            return;
          }

          await refreshActiveRide();
        }
      });

      socket.on('driver:moved', (payload: { rideId: string; lat: number; lng: number }) => {
        if (!mounted) {
          return;
        }
        if (payload.rideId === currentRideId || payload.rideId === activeRideId) {
          setDriverLocation({ lat: payload.lat, lng: payload.lng });
        }
      });
    };

    connectSocket().catch(() => {});
    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, [activeRideId, clearRideState, currentRideId, onBecameActive, onReturnedToIdle, refreshActiveRide]);

  useEffect(() => {
    if (!activeRide) {
      setActiveRideRoute([]);
      setEtaSeconds(null);
      return;
    }

    const fallback = buildRouteCoordinates({
      fromLat:
        activeRide.status === 'ON_THE_WAY' || activeRide.status === 'DRIVER_ASSIGNED' || activeRide.status === 'DRIVER_ARRIVED'
          ? driverLocation?.lat
          : activeRide.fromLat,
      fromLng:
        activeRide.status === 'ON_THE_WAY' || activeRide.status === 'DRIVER_ASSIGNED' || activeRide.status === 'DRIVER_ARRIVED'
          ? driverLocation?.lng
          : activeRide.fromLng,
      stops: activeRide.status === 'IN_PROGRESS' || activeRide.status === 'SEARCHING_DRIVER' ? activeRide.stops ?? [] : [],
      toLat:
        activeRide.status === 'ON_THE_WAY' || activeRide.status === 'DRIVER_ASSIGNED' || activeRide.status === 'DRIVER_ARRIVED'
          ? activeRide.fromLat
          : activeRide.toLat,
      toLng:
        activeRide.status === 'ON_THE_WAY' || activeRide.status === 'DRIVER_ASSIGNED' || activeRide.status === 'DRIVER_ARRIVED'
          ? activeRide.fromLng
          : activeRide.toLng,
    });

    const timeoutId = setTimeout(() => {
      resolveRideRoute({
        status: activeRide.status,
        fromCoord: activeRide.fromLat && activeRide.fromLng ? { lat: activeRide.fromLat, lng: activeRide.fromLng } : null,
        toCoord: activeRide.toLat && activeRide.toLng ? { lat: activeRide.toLat, lng: activeRide.toLng } : null,
        driverCoord: driverLocation,
        stops: activeRide.stops ?? [],
      })
        .then((result) => {
          setActiveRideRoute(result.coordinates.length > 0 ? result.coordinates : fallback);
          setEtaSeconds(result.durationSeconds);
        })
        .catch(() => {
          setActiveRideRoute(fallback);
          setEtaSeconds(null);
        });
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [activeRide, driverLocation]);

  return {
    currentRideId,
    setCurrentRideId,
    activeRideId,
    setActiveRideId,
    activeRide,
    setActiveRide,
    driverLocation,
    activeRideRoute,
    etaSeconds,
    socketState,
    refreshActiveRide,
    clearRideState,
  };
}
