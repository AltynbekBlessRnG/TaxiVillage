import { useCallback, useEffect, useState } from 'react';
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
      if (activeCourierOrderId) {
        socket.emit('join:courier-order', activeCourierOrderId);
      }

      socket.on('courier-order:updated', (updatedOrder: any) => {
        if (!mounted) {
          return;
        }
        if (updatedOrder.id === activeCourierOrderId || updatedOrder.id === activeCourierOrder?.id) {
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
            onForceCourierMode?.();
            onBecameActive?.();
          }

          if (updatedOrder.status === 'DELIVERED' || updatedOrder.status === 'CANCELED') {
            clearCourierState();
            onReturnedToIdle?.();
          }
        }
      });

      socket.on('courier:moved', (payload: { orderId: string; lat: number; lng: number }) => {
        if (!mounted) {
          return;
        }
        if (payload.orderId === activeCourierOrderId || payload.orderId === activeCourierOrder?.id) {
          setCourierLocation({ lat: payload.lat, lng: payload.lng });
        }
      });
    };

    connectSocket().catch(() => {});
    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, [activeCourierOrder?.id, activeCourierOrderId, clearCourierState, onBecameActive, onForceCourierMode, onReturnedToIdle]);

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
