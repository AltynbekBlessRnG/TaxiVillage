import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { apiClient } from '../../../api/client';
import { loadAuth } from '../../../storage/authStorage';
import { createRidesSocket } from '../../../api/socket';
import { buildRouteCoordinates } from '../../../utils/map';
import { resolveRideRoute } from '../../../utils/rideRoute';

const ACTIVE_RIDE_STATUSES = [
  'SEARCHING_DRIVER',
  'DRIVER_ASSIGNED',
  'ON_THE_WAY',
  'DRIVER_ARRIVED',
  'IN_PROGRESS',
] as const;

// The driver can change the price when finishing, so the copy of the ride we
// are holding still carries the estimate. Read it back before the state is
// cleared, and fall back to no figure at all rather than showing a stale one.
async function loadFinalRidePrice(rideId: string): Promise<number | null> {
  try {
    const res = await apiClient.get(`/rides/${rideId}`);
    const price = Number(res.data?.finalPrice ?? res.data?.estimatedPrice ?? 0);
    return Number.isFinite(price) && price > 0 ? Math.round(price) : null;
  } catch {
    return null;
  }
}

export function usePassengerRideState(params: {
  onBecameActive?: () => void;
  onReturnedToIdle?: () => void;
}) {
  const { onBecameActive, onReturnedToIdle } = params;
  const currentRideIdRef = useRef<string | null>(null);
  const activeRideIdRef = useRef<string | null>(null);
  const onBecameActiveRef = useRef(onBecameActive);
  const onReturnedToIdleRef = useRef(onReturnedToIdle);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeRideRoute, setActiveRideRoute] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [socketState, setSocketState] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const [incomingChatToast, setIncomingChatToast] = useState<{ id: string; text: string } | null>(null);
  const socketRef = useRef<ReturnType<typeof createRidesSocket> | null>(null);

  // `message:sent` only reaches sockets that joined the ride's chat room, and
  // the chat screen was the only thing that ever joined it - a passenger
  // watching the map never learned that the driver had written.
  const joinRideChatRoom = useCallback((rideId: string | null | undefined) => {
    if (rideId) {
      socketRef.current?.emit('join:ride', { rideId });
    }
  }, []);

  const clearRideState = useCallback(() => {
    setCurrentRideId(null);
    setActiveRideId(null);
    setActiveRide(null);
    setDriverLocation(null);
    setActiveRideRoute([]);
    setEtaSeconds(null);
  }, []);

  useEffect(() => {
    currentRideIdRef.current = currentRideId;
  }, [currentRideId]);

  useEffect(() => {
    activeRideIdRef.current = activeRideId;
  }, [activeRideId]);

  useEffect(() => {
    onBecameActiveRef.current = onBecameActive;
  }, [onBecameActive]);

  useEffect(() => {
    onReturnedToIdleRef.current = onReturnedToIdle;
  }, [onReturnedToIdle]);

  const refreshActiveRide = useCallback(async () => {
    try {
      const res = await apiClient.get('/rides/current');
      const active = res.data && ACTIVE_RIDE_STATUSES.includes(res.data.status) ? res.data : null;
      setActiveRideId(active?.id ?? null);
      setCurrentRideId((prev) => (!prev ? active?.id ?? null : active?.id === prev ? prev : active?.id ?? null));

      if (active?.id) {
        setActiveRide(active);
        joinRideChatRoom(active.id);
        if (active?.driver?.lat && active?.driver?.lng) {
          setDriverLocation({ lat: active.driver.lat, lng: active.driver.lng });
        }
      } else {
        clearRideState();
      }

      return active ?? null;
    } catch {
      clearRideState();
      return null;
    }
  }, [clearRideState, joinRideChatRoom]);

  useEffect(() => {
    let socket: ReturnType<typeof createRidesSocket> | null = null;
    let mounted = true;

    const connectSocket = async () => {
      const auth = await loadAuth();
      if (!mounted || !auth?.accessToken) {
        return;
      }

      socket = createRidesSocket(auth.accessToken);
      socketRef.current = socket;
      // Rooms live on the connection, so a reconnect drops the chat room and
      // it has to be claimed again.
      const handleConnected = () => {
        if (!mounted) {
          return;
        }
        setSocketState('connected');
        joinRideChatRoom(activeRideIdRef.current ?? currentRideIdRef.current);
      };
      socket.on('connect', handleConnected);
      socket.on('disconnect', () => mounted && setSocketState('disconnected'));
      socket.io.on('reconnect_attempt', () => mounted && setSocketState('reconnecting'));
      socket.io.on('reconnect', handleConnected);
      socket.on('connect_error', () => mounted && setSocketState('reconnecting'));

      socket.on('ride:updated', async (updatedRide: { id: string; status: string }) => {
        if (!mounted) {
          return;
        }

        if (updatedRide.id === currentRideIdRef.current || updatedRide.id === activeRideIdRef.current) {
          if (updatedRide.status === 'DRIVER_ASSIGNED' || updatedRide.status === 'ON_THE_WAY') {
            setCurrentRideId(updatedRide.id);
            setActiveRideId(updatedRide.id);
            await refreshActiveRide();
            onBecameActiveRef.current?.();
            return;
          }

          if (updatedRide.status === 'DRIVER_ARRIVED') {
            await refreshActiveRide();
            onBecameActiveRef.current?.();
            return;
          }

          if (updatedRide.status === 'IN_PROGRESS') {
            await refreshActiveRide();
            return;
          }

          if (updatedRide.status === 'CANCELED') {
            clearRideState();
            onReturnedToIdleRef.current?.();
            return;
          }

          if (updatedRide.status === 'COMPLETED') {
            // The banner comes from the server; this is the in-app word, so
            // the sheet does not just vanish mid-screen with the ride over.
            const finalPrice = await loadFinalRidePrice(updatedRide.id);
            const priceLine = finalPrice ? ` Стоимость: ${finalPrice} ₸.` : '';
            clearRideState();
            onReturnedToIdleRef.current?.();
            Alert.alert('Поездка завершена', `Спасибо, что выбрали Zhetysu Go!${priceLine}`);
            return;
          }

          await refreshActiveRide();
        }
      });

      socket.on('driver:moved', (payload: { rideId: string; lat: number; lng: number }) => {
        if (!mounted) {
          return;
        }
        if (payload.rideId === currentRideIdRef.current || payload.rideId === activeRideIdRef.current) {
          setDriverLocation({ lat: payload.lat, lng: payload.lng });
        }
      });

      socket.on('message:sent', (message: { id: string; rideId?: string; senderType?: string; content?: string }) => {
        if (!mounted) {
          return;
        }

        const isCurrentRide = message.rideId === currentRideIdRef.current || message.rideId === activeRideIdRef.current;
        if (!isCurrentRide || message.senderType !== 'DRIVER' || !message.content?.trim()) {
          return;
        }

        setIncomingChatToast({
          id: message.id,
          text: message.content.trim(),
        });
      });
    };

    connectSocket().catch(() => {});
    return () => {
      mounted = false;
      socketRef.current = null;
      socket?.disconnect();
    };
  }, [clearRideState, joinRideChatRoom, refreshActiveRide]);

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
    incomingChatToast,
    setIncomingChatToast,
    refreshActiveRide,
    clearRideState,
  };
}
