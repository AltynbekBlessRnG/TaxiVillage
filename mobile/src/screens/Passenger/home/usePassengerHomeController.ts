import { Alert } from 'react-native';
import { useCallback } from 'react';
import { apiClient } from '../../../api/client';
import { geocodeAddressWithGoogle } from '../../../utils/googleMaps';
import type {
  PassengerCoordinates,
  PassengerLocationPrecision,
  PassengerSearchMode,
  PassengerStop,
} from './usePassengerFlowStore';

const hasValidCoordinates = (coords?: PassengerCoordinates | null) =>
  !!coords &&
  Number.isFinite(coords.lat) &&
  Number.isFinite(coords.lng) &&
  !(coords.lat === 0 && coords.lng === 0);

interface UsePassengerHomeControllerParams {
  activeService: 'Такси' | 'Курьер' | 'Еда' | 'Межгород';
  fromAddress: string;
  toAddress: string;
  fromCoord: PassengerCoordinates | null;
  toCoord: PassengerCoordinates | null;
  fromLocationPrecision: PassengerLocationPrecision;
  toLocationPrecision: PassengerLocationPrecision;
  comment: string;
  offeredPrice: string;
  stops: PassengerStop[];
  searchMode: PassengerSearchMode;
  courierItemDescription: string;
  courierPackageWeight: string;
  courierPackageSize: string;
  userLocation?: PassengerCoordinates | null;
  currentRideId: string | null;
  activeRideId: string | null;
  activeCourierOrderId: string | null;
  setLoading: (value: boolean) => void;
  changeState: (state: 'IDLE' | 'SEARCH' | 'MAP_PICK' | 'ORDER_SETUP' | 'SEARCHING') => void;
  clearCourierState: () => void;
  refreshActiveRide: () => Promise<any>;
  setCurrentRideId: (id: string | null) => void;
  setActiveRideId: (id: string | null) => void;
  setActiveCourierOrderId: (id: string | null) => void;
  setActiveCourierOrder: (value: any) => void;
  setShowSearchingDetails: (value: boolean) => void;
  resetTaxiDraft: () => void;
  resetCourierDraft: () => void;
  setFromAddress: (value: string) => void;
  setToAddress: (value: string) => void;
  setFromCoord: (value: PassengerCoordinates | null) => void;
  setToCoord: (value: PassengerCoordinates | null) => void;
  setFromLocationPrecision: (value: PassengerLocationPrecision) => void;
  setToLocationPrecision: (value: PassengerLocationPrecision) => void;
  setStops: (value: PassengerStop[] | ((current: PassengerStop[]) => PassengerStop[])) => void;
  setSearchMode: (value: PassengerSearchMode) => void;
  setIsStopSelectionMode: (value: boolean) => void;
  setSearchInitialField: (value: 'from' | 'to') => void;
}

export const usePassengerHomeController = ({
  activeService,
  fromAddress,
  toAddress,
  fromCoord,
  toCoord,
  fromLocationPrecision,
  toLocationPrecision,
  comment,
  offeredPrice,
  stops,
  searchMode,
  courierItemDescription,
  courierPackageWeight,
  courierPackageSize,
  userLocation,
  currentRideId,
  activeRideId,
  activeCourierOrderId,
  setLoading,
  changeState,
  clearCourierState,
  refreshActiveRide,
  setCurrentRideId,
  setActiveRideId,
  setActiveCourierOrderId,
  setActiveCourierOrder,
  setShowSearchingDetails,
  resetTaxiDraft,
  resetCourierDraft,
  setFromAddress,
  setToAddress,
  setFromCoord,
  setToCoord,
  setFromLocationPrecision,
  setToLocationPrecision,
  setStops,
  setSearchMode,
  setIsStopSelectionMode,
  setSearchInitialField,
}: UsePassengerHomeControllerParams) => {
  const handleGeocodeAndProceed = useCallback(async () => {
    if (!toAddress) {
      Alert.alert('Ошибка', 'Введите адрес назначения');
      return;
    }

    if (activeService === 'Такси' && fromAddress.trim() && toAddress.trim()) {
      if (hasValidCoordinates(fromCoord) && hasValidCoordinates(toCoord)) {
        setFromLocationPrecision('EXACT');
        setToLocationPrecision('EXACT');
        changeState('ORDER_SETUP');
        return;
      }
    }

    if (fromCoord && toCoord) {
      changeState('ORDER_SETUP');
      return;
    }

    setLoading(true);
    try {
      const [f, t] = await Promise.all([
        hasValidCoordinates(fromCoord)
          ? Promise.resolve(null)
          : geocodeAddressWithGoogle(fromAddress, userLocation).catch(() => null),
        hasValidCoordinates(toCoord)
          ? Promise.resolve(null)
          : geocodeAddressWithGoogle(toAddress, userLocation).catch(() => null),
      ]);

      if (f) {
        setFromAddress(f.address);
        setFromCoord({ lat: f.lat, lng: f.lng });
        setFromLocationPrecision('EXACT');
      } else if (activeService === 'Такси' && fromAddress.trim()) {
        setFromCoord(null);
        setFromLocationPrecision('LANDMARK_TEXT');
      }

      if (t) {
        setToAddress(t.address);
        setToCoord({ lat: t.lat, lng: t.lng });
        setToLocationPrecision('EXACT');
      } else if (activeService === 'Такси' && toAddress.trim()) {
        setToCoord(null);
        setToLocationPrecision('LANDMARK_TEXT');
      }

      changeState('ORDER_SETUP');
    } finally {
      setLoading(false);
    }
  }, [
    activeService,
    changeState,
    fromAddress,
    fromCoord,
    setFromAddress,
    setFromCoord,
    setFromLocationPrecision,
    setLoading,
    setToAddress,
    setToCoord,
    setToLocationPrecision,
    toAddress,
    toCoord,
    userLocation,
  ]);

  const handleCreateRide = useCallback(async () => {
    if (activeService === 'Курьер') {
      if (!courierItemDescription.trim()) {
        Alert.alert('Не хватает данных', 'Опишите, что нужно доставить.');
        return;
      }

      if (!hasValidCoordinates(fromCoord) || !hasValidCoordinates(toCoord)) {
        Alert.alert('Нужны координаты', 'Выберите адреса забора и доставки из подсказок или на карте.');
        return;
      }

      const pickupCoord = fromCoord;
      const dropoffCoord = toCoord;
      if (!pickupCoord || !dropoffCoord) {
        return;
      }

      setLoading(true);
      try {
        const res = await apiClient.post('/courier-orders', {
          pickupAddress: fromAddress,
          pickupLat: pickupCoord.lat,
          pickupLng: pickupCoord.lng,
          dropoffAddress: toAddress,
          dropoffLat: dropoffCoord.lat,
          dropoffLng: dropoffCoord.lng,
          itemDescription: courierItemDescription.trim(),
          packageWeight: courierPackageWeight.trim() || undefined,
          packageSize: courierPackageSize.trim() || undefined,
          comment: comment.trim() || undefined,
          estimatedPrice: parseFloat(offeredPrice) || undefined,
        });

        setActiveCourierOrderId(res.data?.id ?? null);
        setActiveCourierOrder(res.data ?? null);
        setShowSearchingDetails(false);
        changeState('SEARCHING');
      } catch (e: any) {
        const serverMessage = e.response?.data?.message;
        const errorMessage = Array.isArray(serverMessage) ? serverMessage.join(', ') : serverMessage;
        Alert.alert('Ошибка сервера', errorMessage || 'Не удалось создать заказ доставки');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!toAddress) {
      Alert.alert('Ошибка', 'Укажите адрес назначения');
      return;
    }

    if (!fromAddress.trim()) {
      Alert.alert('Ошибка', 'Укажите адрес подачи');
      return;
    }

    const hasExactPickup = hasValidCoordinates(fromCoord);
    const hasExactDropoff = hasValidCoordinates(toCoord);

    if (
      fromLocationPrecision === 'EXACT' &&
      toLocationPrecision === 'EXACT' &&
      (!hasExactPickup || !hasExactDropoff)
    ) {
      Alert.alert('Нужны координаты', 'Выберите адрес из подсказок Google или укажите точку на карте.');
      return;
    }

    if (stops.some((stop) => !hasValidCoordinates(stop))) {
      Alert.alert('Нужны координаты', 'Один из заездов не содержит корректную точку. Выберите его заново.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        fromAddress,
        toAddress,
        fromLat: hasExactPickup ? fromCoord!.lat : undefined,
        fromLng: hasExactPickup ? fromCoord!.lng : undefined,
        toLat: hasExactDropoff ? toCoord!.lat : undefined,
        toLng: hasExactDropoff ? toCoord!.lng : undefined,
        pickupLocationPrecision: fromLocationPrecision,
        dropoffLocationPrecision: toLocationPrecision,
        comment,
        stops: stops.map((stop) => ({
          address: stop.address,
          lat: stop.lat,
          lng: stop.lng,
        })),
        estimatedPrice: parseFloat(offeredPrice) || 0,
      };

      const res = await apiClient.post('/rides', payload);
      if (res.data?.id) {
        setCurrentRideId(res.data.id);
        setActiveRideId(res.data.id);
        setShowSearchingDetails(false);
        changeState('SEARCHING');
      }
    } catch (e: any) {
      const serverMessage = e.response?.data?.message;
      const errorMessage = Array.isArray(serverMessage)
        ? serverMessage.join(', ')
        : serverMessage;
      Alert.alert('Ошибка сервера', errorMessage || 'Не удалось создать заказ');
    } finally {
      setLoading(false);
    }
  }, [
    activeService,
    changeState,
    comment,
    courierItemDescription,
    courierPackageSize,
    courierPackageWeight,
    fromAddress,
    fromCoord,
    fromLocationPrecision,
    offeredPrice,
    setActiveCourierOrder,
    setActiveCourierOrderId,
    setActiveRideId,
    setCurrentRideId,
    setLoading,
    setShowSearchingDetails,
    stops,
    toAddress,
    toCoord,
    toLocationPrecision,
  ]);

  const handleCancelSearchingRide = useCallback(async () => {
    if (activeService === 'Курьер' && activeCourierOrderId) {
      Alert.alert('Отменить доставку?', 'Мы прекратим поиск курьера для этого заказа.', [
        { text: 'Нет', style: 'cancel' },
        {
          text: 'Да',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await apiClient.post(`/courier-orders/${activeCourierOrderId}/cancel`);
              clearCourierState();
              resetCourierDraft();
              setShowSearchingDetails(false);
              changeState('IDLE');
            } catch (e: any) {
              const message = e.response?.data?.message || 'Не удалось отменить заказ';
              Alert.alert('Ошибка', message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]);
      return;
    }

    const rideIdToCancel = currentRideId ?? activeRideId;
    if (!rideIdToCancel) {
      resetTaxiDraft();
      changeState('IDLE');
      return;
    }

    Alert.alert('Отменить поездку?', 'Мы прекратим поиск водителя для этого заказа.', [
      { text: 'Нет', style: 'cancel' },
      {
        text: 'Да',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await apiClient.post(`/rides/${rideIdToCancel}/cancel`);
            setCurrentRideId(null);
            setActiveRideId(null);
            await refreshActiveRide();
            resetTaxiDraft();
            setShowSearchingDetails(false);
            changeState('IDLE');
          } catch (e: any) {
            const message = e.response?.data?.message || 'Не удалось отменить заказ';
            Alert.alert('Ошибка', message);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }, [
    activeCourierOrderId,
    activeRideId,
    activeService,
    changeState,
    clearCourierState,
    currentRideId,
    refreshActiveRide,
    resetCourierDraft,
    resetTaxiDraft,
    setActiveRideId,
    setCurrentRideId,
    setLoading,
    setShowSearchingDetails,
  ]);

  const handleAddressSelect = useCallback((field: 'from' | 'to', address: string, lat: number, lng: number) => {
    if (field === 'from') {
      setFromAddress(address);
      const hasCoords = hasValidCoordinates({ lat, lng });
      setFromCoord(hasCoords ? { lat, lng } : null);
      setFromLocationPrecision(hasCoords ? 'EXACT' : 'LANDMARK_TEXT');
      return;
    }

    if (searchMode === 'stop') {
      if (!hasValidCoordinates({ lat, lng })) {
        Alert.alert('Нужны координаты', 'Выберите адрес из подсказок Google или укажите точку на карте.');
        return;
      }
      setStops((current) => [...current, { address, lat, lng }]);
      setSearchMode('route');
      changeState('ORDER_SETUP');
      return;
    }

    setToAddress(address);
    const hasCoords = hasValidCoordinates({ lat, lng });
    setToCoord(hasCoords ? { lat, lng } : null);
    setToLocationPrecision(hasCoords ? 'EXACT' : 'LANDMARK_TEXT');
  }, [
    changeState,
    searchMode,
    setFromAddress,
    setFromCoord,
    setFromLocationPrecision,
    setSearchMode,
    setStops,
    setToAddress,
    setToCoord,
    setToLocationPrecision,
  ]);

  const handleCustomLandmarkSelect = useCallback((field: 'from' | 'to', address: string) => {
    if (field === 'from') {
      setFromAddress(address);
      setFromCoord(null);
      setFromLocationPrecision('LANDMARK_TEXT');
      return;
    }

    setToAddress(address);
    setToCoord(null);
    setToLocationPrecision('LANDMARK_TEXT');
  }, [setFromAddress, setFromCoord, setFromLocationPrecision, setToAddress, setToCoord, setToLocationPrecision]);

  const openSearchSheet = useCallback((field: 'from' | 'to') => {
    setSearchInitialField(field);
    setSearchMode('route');
    setIsStopSelectionMode(false);
    changeState('SEARCH');
  }, [changeState, setIsStopSelectionMode, setSearchInitialField, setSearchMode]);

  return {
    handleGeocodeAndProceed,
    handleCreateRide,
    handleCancelSearchingRide,
    handleAddressSelect,
    handleCustomLandmarkSelect,
    openSearchSheet,
  };
};
