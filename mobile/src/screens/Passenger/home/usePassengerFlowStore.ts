import { create } from 'zustand';

export type PassengerScreenState = 'IDLE' | 'SEARCH' | 'MAP_PICK' | 'ORDER_SETUP' | 'SEARCHING';
export type PassengerServiceType = 'Такси' | 'Курьер' | 'Еда' | 'Межгород';
export type PassengerSearchMode = 'route' | 'stop';
export type PassengerLocationPrecision = 'EXACT' | 'LANDMARK_TEXT';
export type PassengerMapPickTarget = 'from' | 'to' | 'stop';
export type PassengerInitialField = 'from' | 'to';

export interface PassengerCoordinates {
  lat: number;
  lng: number;
}

export interface PassengerStop extends PassengerCoordinates {
  address: string;
}

export interface PassengerRoutePoint {
  latitude: number;
  longitude: number;
}

interface PassengerFlowState {
  screenState: PassengerScreenState;
  activeService: PassengerServiceType;
  fromAddress: string;
  toAddress: string;
  fromCoord: PassengerCoordinates | null;
  toCoord: PassengerCoordinates | null;
  fromLocationPrecision: PassengerLocationPrecision;
  toLocationPrecision: PassengerLocationPrecision;
  offeredPrice: string;
  comment: string;
  stops: PassengerStop[];
  isStopSelectionMode: boolean;
  showSearchingDetails: boolean;
  mapPickTarget: PassengerMapPickTarget;
  searchMode: PassengerSearchMode;
  searchInitialField: PassengerInitialField;
  displayRoute: PassengerRoutePoint[];
  courierItemDescription: string;
  courierPackageWeight: string;
  courierPackageSize: string;
  setScreenState: (screenState: PassengerScreenState) => void;
  setActiveService: (activeService: PassengerServiceType) => void;
  setFromAddress: (fromAddress: string) => void;
  setToAddress: (toAddress: string) => void;
  setFromCoord: (fromCoord: PassengerCoordinates | null) => void;
  setToCoord: (toCoord: PassengerCoordinates | null) => void;
  setFromLocationPrecision: (precision: PassengerLocationPrecision) => void;
  setToLocationPrecision: (precision: PassengerLocationPrecision) => void;
  setOfferedPrice: (offeredPrice: string) => void;
  setComment: (comment: string) => void;
  setStops: (stops: PassengerStop[] | ((current: PassengerStop[]) => PassengerStop[])) => void;
  setIsStopSelectionMode: (isStopSelectionMode: boolean) => void;
  setShowSearchingDetails: (showSearchingDetails: boolean) => void;
  setMapPickTarget: (mapPickTarget: PassengerMapPickTarget) => void;
  setSearchMode: (searchMode: PassengerSearchMode) => void;
  setSearchInitialField: (searchInitialField: PassengerInitialField) => void;
  setDisplayRoute: (displayRoute: PassengerRoutePoint[]) => void;
  setCourierItemDescription: (courierItemDescription: string) => void;
  setCourierPackageWeight: (courierPackageWeight: string) => void;
  setCourierPackageSize: (courierPackageSize: string) => void;
  resetTaxiDraft: () => void;
  resetCourierDraft: () => void;
}

export const usePassengerFlowStore = create<PassengerFlowState>((set) => ({
  screenState: 'IDLE',
  activeService: 'Такси',
  fromAddress: 'Определяем адрес...',
  toAddress: '',
  fromCoord: null,
  toCoord: null,
  fromLocationPrecision: 'EXACT',
  toLocationPrecision: 'EXACT',
  offeredPrice: '',
  comment: '',
  stops: [],
  isStopSelectionMode: false,
  showSearchingDetails: false,
  mapPickTarget: 'to',
  searchMode: 'route',
  searchInitialField: 'to',
  displayRoute: [],
  courierItemDescription: '',
  courierPackageWeight: '',
  courierPackageSize: '',
  setScreenState: (screenState) => set({ screenState }),
  setActiveService: (activeService) => set({ activeService }),
  setFromAddress: (fromAddress) => set({ fromAddress }),
  setToAddress: (toAddress) => set({ toAddress }),
  setFromCoord: (fromCoord) => set({ fromCoord }),
  setToCoord: (toCoord) => set({ toCoord }),
  setFromLocationPrecision: (fromLocationPrecision) => set({ fromLocationPrecision }),
  setToLocationPrecision: (toLocationPrecision) => set({ toLocationPrecision }),
  setOfferedPrice: (offeredPrice) => set({ offeredPrice }),
  setComment: (comment) => set({ comment }),
  setStops: (stops) =>
    set((state) => ({
      stops: typeof stops === 'function' ? stops(state.stops) : stops,
    })),
  setIsStopSelectionMode: (isStopSelectionMode) => set({ isStopSelectionMode }),
  setShowSearchingDetails: (showSearchingDetails) => set({ showSearchingDetails }),
  setMapPickTarget: (mapPickTarget) => set({ mapPickTarget }),
  setSearchMode: (searchMode) => set({ searchMode }),
  setSearchInitialField: (searchInitialField) => set({ searchInitialField }),
  setDisplayRoute: (displayRoute) => set({ displayRoute }),
  setCourierItemDescription: (courierItemDescription) => set({ courierItemDescription }),
  setCourierPackageWeight: (courierPackageWeight) => set({ courierPackageWeight }),
  setCourierPackageSize: (courierPackageSize) => set({ courierPackageSize }),
  resetTaxiDraft: () =>
    set({
      toAddress: '',
      toCoord: null,
      toLocationPrecision: 'EXACT',
      offeredPrice: '',
      comment: '',
      stops: [],
      displayRoute: [],
      searchMode: 'route',
      isStopSelectionMode: false,
      mapPickTarget: 'to',
    }),
  resetCourierDraft: () =>
    set({
      toAddress: '',
      toCoord: null,
      toLocationPrecision: 'EXACT',
      offeredPrice: '',
      comment: '',
      courierItemDescription: '',
      courierPackageWeight: '',
      courierPackageSize: '',
      displayRoute: [],
      searchMode: 'route',
      mapPickTarget: 'to',
    }),
}));
