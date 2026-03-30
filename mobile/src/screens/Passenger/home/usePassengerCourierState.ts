import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../api/client';
import { loadAuth } from '../../../storage/authStorage';
import { createCourierOrdersSocket } from '../../../api/socket';
import { buildRouteCoordinates } from '../../../utils/map';
import { getGoogleDirections } from '../../../utils/googleMaps';

export function usePassengerCourierState(params: {
  onBecameActive?: () => void;
  onReturnedToIdle?: () => void;
  onForceCourierMode?: () => void;
}) {
  const { onBecameActive, onReturnedToIdle, onForceCourierMode } = params;
  const activeCourierOrderIdRef = useRef<string | null>(null);
  const activeCourierOrderRef = useRef<any>(null);
  const onBecameActiveRef = useRef(onBecameActive);
  const onReturnedToIdleRef = useRef(onReturnedToIdle);
  const onForceCourierModeRef = useRef(onForceCourierMode);
  const [activeCourierOrderId, setActiveCourierOrderId] = useState<string | null>(null);
  const [activeCourierOrder, setActiveCourierOrder] = useState<any>(null);
  const [courierLocation, setCourierLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeCourierRoute, setActiveCourierRoute] = useState<Array<{ latitude: number; longitude: number }>>([]);

  const clearCourierState = useCallback(() => {
    setActiveCourierOrderId(null);
    setActiveCourierOrder(null);
    setCourierLocation(null);
    setActiveCourierRoute([]);
  }, []);

  useEffect(() => {
    activeCourierOrderIdRef.current = activeCourierOrderId;
  }, [activeCourierOrderId]);

  useEffect(() => {
    activeCourierOrderRef.current = activeCourierOrder;
  }, [activeCourierOrder]);

  useEffect(() => {
    onBecameActiveRef.current = onBecameActive;
  }, [onBecameActive]);

  useEffect(() => {
    onReturnedToIdleRef.current = onReturnedToIdle;
  }, [onReturnedToIdle]);

  useEffect(() => {
    onForceCourierModeRef.current = onForceCourierMode;
  }, [onForceCourierMode]);

  const refreshActiveCourierOrder = useCallback(async () => {
    try {
      const res = await apiClient.get('/courier-orders/current');
      setActiveCourierOrderId(res.data?.id ?? null);
      setActiveCourierOrder(res.data ?? null);
      if (res.data?.courier?.lat && res.data?.courier?.lng) {
        setCourierLocation({ lat: res.data.courier.lat, lng: res.data.courier.lng });
      }
      return res.data ?? null;
    } catch {
      clearCourierState();
      return null;
    }
  }, [clearCourierState]);

  useEffect(() => {
    let socket: ReturnType<typeof createCourierOrdersSocket> | null = null;
    let mounted = true;

    const connectSocket = async () => {
      const auth = await loadAuth();
      if (!mounted || !auth?.accessToken) {
        return;
      }

      socket = createCourierOrdersSocket(auth.accessToken);
      if (activeCourierOrderIdRef.current) {
        socket.emit('join:courier-order', activeCourierOrderIdRef.current);
      }

      socket.on('courier-order:updated', (updatedOrder: any) => {
        if (!mounted) {
          return;
        }
        if (updatedOrder.id === activeCourierOrderIdRef.current || updatedOrder.id === activeCourierOrderRef.current?.id) {
          setActiveCourierOrder(updatedOrder);
          setActiveCourierOrderId(updatedOrder.id);
          if (updatedOrder?.courier?.lat && updatedOrder?.courier?.lng) {
            setCourierLocation({ lat: updatedOrder.courier.lat, lng: updatedOrder.courier.lng });
          }

          if (
            updatedOrder.status === 'TO_PICKUP' ||
            updatedOrder.status === 'COURIER_ARRIVED' ||
            updatedOrder.status === 'TO_RECIPIENT' ||
            updatedOrder.status === 'SEARCHING_COURIER'
          ) {
            onForceCourierModeRef.current?.();
            onBecameActiveRef.current?.();
          }

          if (updatedOrder.status === 'DELIVERED' || updatedOrder.status === 'CANCELED') {
            clearCourierState();
            onReturnedToIdleRef.current?.();
          }
        }
      });

      socket.on('courier:moved', (payload: { orderId: string; lat: number; lng: number }) => {
        if (!mounted) {
          return;
        }
        if (payload.orderId === activeCourierOrderIdRef.current || payload.orderId === activeCourierOrderRef.current?.id) {
          setCourierLocation({ lat: payload.lat, lng: payload.lng });
        }
      });
    };

    connectSocket().catch(() => {});
    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, [clearCourierState, refreshActiveCourierOrder]);

  useEffect(() => {
    if (!activeCourierOrder) {
      setActiveCourierRoute([]);
      return;
    }

    const fallback =
      activeCourierOrder.status === 'SEARCHING_COURIER'
        ? buildRouteCoordinates({
            fromLat: activeCourierOrder.pickupLat,
            fromLng: activeCourierOrder.pickupLng,
            toLat: activeCourierOrder.dropoffLat,
            toLng: activeCourierOrder.dropoffLng,
          })
        : buildRouteCoordinates({
            fromLat: courierLocation?.lat,
            fromLng: courierLocation?.lng,
            toLat: activeCourierOrder.status === 'TO_RECIPIENT' ? activeCourierOrder.dropoffLat : activeCourierOrder.pickupLat,
            toLng: activeCourierOrder.status === 'TO_RECIPIENT' ? activeCourierOrder.dropoffLng : activeCourierOrder.pickupLng,
          });

    if (activeCourierOrder.status === 'SEARCHING_COURIER') {
      setActiveCourierRoute(fallback);
      return;
    }

    const destination =
      activeCourierOrder.status === 'TO_RECIPIENT'
        ? { lat: activeCourierOrder.dropoffLat, lng: activeCourierOrder.dropoffLng }
        : { lat: activeCourierOrder.pickupLat, lng: activeCourierOrder.pickupLng };

    if (!courierLocation || !destination?.lat || !destination?.lng) {
      setActiveCourierRoute(fallback);
      return;
    }

    getGoogleDirections({ origin: courierLocation, destination })
      .then((result) => setActiveCourierRoute(result.coordinates.length > 0 ? result.coordinates : fallback))
      .catch(() => setActiveCourierRoute(fallback));
  }, [activeCourierOrder, courierLocation]);

  return {
    activeCourierOrderId,
    setActiveCourierOrderId,
    activeCourierOrder,
    setActiveCourierOrder,
    courierLocation,
    activeCourierRoute,
    refreshActiveCourierOrder,
    clearCourierState,
  };
}
