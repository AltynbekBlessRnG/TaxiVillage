import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import BottomSheet, { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import {
  formatGooglePredictionAddress,
  getGooglePlaceDetails,
  reverseGeocodeWithGoogle,
  searchGooglePlaces,
} from '../../utils/googleMaps';
import { loadRecentAddresses, saveRecentAddress, type RecentAddress } from '../../storage/recentAddresses';

interface GooglePlacePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

interface Props {
  visible: boolean;
  initialField?: 'from' | 'to';
  mode: 'route' | 'stop';
  fromAddress: string;
  setFromAddress: (t: string) => void;
  toAddress: string;
  setToAddress: (t: string) => void;
  isStopSelectionMode: boolean;
  userLocation?: { lat: number; lng: number } | null;
  onClose: () => void;
  onMapPick: (field: 'from' | 'to' | 'stop') => void;
  onSubmit: () => void;
  onAddressSelect: (field: 'from' | 'to', address: string, lat: number, lng: number) => void;
  onDestinationReady?: () => void;
  onCustomLandmarkSelect?: (field: 'from' | 'to', address: string) => void;
  fromPlaceholder?: string;
  toPlaceholder?: string;
  title?: string;
}

export const SearchSheet: React.FC<Props> = ({
  visible,
  initialField = 'to',
  mode,
  fromAddress,
  setFromAddress,
  toAddress,
  setToAddress,
  isStopSelectionMode,
  userLocation,
  onClose,
  onMapPick,
  onSubmit,
  onAddressSelect,
  onDestinationReady,
  onCustomLandmarkSelect,
  fromPlaceholder = 'Откуда?',
  toPlaceholder = 'Куда?',
  title,
}) => {
  const [searchResults, setSearchResults] = useState<GooglePlacePrediction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  const [recentAddresses, setRecentAddresses] = useState<RecentAddress[]>([]);
  const [stopAddress, setStopAddress] = useState('');
  const [fromInputValue, setFromInputValue] = useState(fromAddress);
  const [toInputValue, setToInputValue] = useState(toAddress);
  const fromInputRef = useRef<any>(null);
  const toInputRef = useRef<any>(null);
  const snapPoints = useMemo(() => ['86%'], []);

  useEffect(() => {
    if (!visible) {
      setActiveField(null);
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    const targetField = mode === 'stop' ? 'to' : initialField;
    setActiveField(targetField);
    setFromInputValue(fromAddress);
    setToInputValue(toAddress);
    setSearchQuery(
      targetField === 'from'
        ? fromAddress
        : mode === 'stop'
        ? stopAddress
        : toAddress,
    );

    const timeoutId = setTimeout(() => {
      if (targetField === 'from') {
        fromInputRef.current?.focus?.();
      } else {
        toInputRef.current?.focus?.();
      }
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [visible, initialField, mode, fromAddress, toAddress, stopAddress]);

  useEffect(() => {
    if (mode === 'stop') {
      setStopAddress('');
      setSearchQuery('');
      setActiveField('to');
      setTimeout(() => toInputRef.current?.focus?.(), 250);
    }
  }, [mode]);

  useEffect(() => {
    if (activeField !== 'from') {
      setFromInputValue(fromAddress);
    }
  }, [activeField, fromAddress]);

  useEffect(() => {
    if (mode === 'stop') {
      return;
    }

    if (activeField !== 'to') {
      setToInputValue(toAddress);
    }
  }, [activeField, mode, toAddress]);

  useEffect(() => {
    if (!activeField || searchQuery.trim().length >= 3) {
      return;
    }

    loadRecentAddresses()
      .then(setRecentAddresses)
      .catch(() => setRecentAddresses([]));
  }, [activeField, searchQuery]);

  const fetchSearchResults = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await searchGooglePlaces(query, userLocation);
      setSearchResults(data);
    } catch {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  const debouncedFetchSearchResults = useCallback(
    (query: string) => {
      const timeoutId = setTimeout(() => fetchSearchResults(query), 500);
      return () => clearTimeout(timeoutId);
    },
    [fetchSearchResults],
  );

  useEffect(() => debouncedFetchSearchResults(searchQuery), [searchQuery, debouncedFetchSearchResults]);

  const completeAddressSelection = async (
    field: 'from' | 'to',
    address: string,
    lat: number,
    lng: number,
  ) => {
    if (field === 'from') {
      setFromInputValue(address);
    } else if (isStopSelectionMode) {
      setStopAddress('');
    } else {
      setToInputValue(address);
    }

    onAddressSelect(field, address, lat, lng);
    await saveRecentAddress(address, lat, lng);
    setSearchQuery('');
    setSearchResults([]);
    setActiveField(null);

    if (field === 'to' && !isStopSelectionMode) {
      setTimeout(() => {
        onDestinationReady?.();
      }, 0);
    } else if (field === 'from') {
      if (!toAddress.trim()) {
        setTimeout(() => toInputRef.current?.focus?.(), 100);
      } else {
        setTimeout(onSubmit, 100);
      }
    } else if (isStopSelectionMode) {
      setTimeout(onSubmit, 100);
    }
  };

  const handleAddressSelect = async (feature: GooglePlacePrediction, field: 'from' | 'to') => {
    setLoading(true);
    try {
      const location = await getGooglePlaceDetails(feature.place_id);
      const shortAddress = formatGooglePredictionAddress(feature);
      await completeAddressSelection(field, shortAddress, location.lat, location.lng);
    } finally {
      setLoading(false);
    }
  };

  const handleRecentAddressSelect = async (item: RecentAddress) => {
    if (!activeField) {
      return;
    }

    await completeAddressSelection(activeField, item.address, item.lat, item.lng);
  };

  const handleUseCurrentLocation = async () => {
    if (!activeField || !userLocation) {
      return;
    }

    setLoading(true);
    try {
      const address = await reverseGeocodeWithGoogle(userLocation.lat, userLocation.lng);
      await completeAddressSelection(activeField, address, userLocation.lat, userLocation.lng);
    } finally {
      setLoading(false);
    }
  };

  const handleUseAsLandmark = () => {
    const normalized = searchQuery.trim();
    if (!activeField || !normalized || isStopSelectionMode) {
      return;
    }

    const selectedField = activeField;
    if (selectedField === 'from') {
      setFromInputValue(normalized);
    } else {
      setToInputValue(normalized);
    }
    onCustomLandmarkSelect?.(activeField, normalized);
    setSearchQuery('');
    setSearchResults([]);
    setActiveField(null);

    if (selectedField === 'to') {
      setTimeout(() => {
        onDestinationReady?.();
      }, 0);
      return;
    }

    if (toAddress.trim()) {
      setTimeout(onSubmit, 0);
      return;
    }

    setTimeout(() => {
      toInputRef.current?.focus?.();
    }, 100);
  };

  const handleFromSubmit = () => {
    if (toAddress.trim().length > 0) {
      onSubmit();
    } else {
      toInputRef.current?.focus?.();
    }
  };

  const handleToSubmit = () => {
    if (isStopSelectionMode && stopAddress.trim()) {
      Alert.alert('Выберите адрес', 'Выберите адрес из подсказок Google или укажите точку на карте.');
      return;
    }
    onSubmit();
  };

  const renderCurrentLocationButton = () => {
    if (!activeField || !userLocation) {
      return null;
    }

    return (
      <TouchableOpacity style={styles.currentLocationButton} onPress={() => void handleUseCurrentLocation()}>
        <Text style={styles.currentLocationTitle}>📍 Текущее местоположение</Text>
        <Text style={styles.currentLocationSubtitle}>Определить адрес по вашей геопозиции</Text>
      </TouchableOpacity>
    );
  };

  const renderSuggestionItem = ({ item }: { item: GooglePlacePrediction }) => {
    const mainText = item.structured_formatting?.main_text || item.description;
    const subText = item.structured_formatting?.secondary_text || '';

    return (
      <TouchableOpacity style={styles.suggestionItem} onPress={() => void handleAddressSelect(item, activeField!)}>
        <Text style={styles.suggestionText}>{mainText}</Text>
        {subText ? <Text style={styles.suggestionSubText}>{subText}</Text> : null}
      </TouchableOpacity>
    );
  };

  const renderRecentItem = ({ item }: { item: RecentAddress }) => (
    <TouchableOpacity style={styles.suggestionItem} onPress={() => void handleRecentAddressSelect(item)}>
      <Text style={styles.suggestionText}>{item.address}</Text>
      <Text style={styles.suggestionSubText}>Недавний адрес</Text>
    </TouchableOpacity>
  );

  const renderLandmarkFallback = () => {
    const normalized = searchQuery.trim();
    if (!activeField || isStopSelectionMode || normalized.length < 3) {
      return null;
    }

    return (
      <TouchableOpacity style={styles.landmarkButton} onPress={handleUseAsLandmark}>
        <Text style={styles.landmarkTitle}>Использовать как ориентир</Text>
        <Text style={styles.landmarkValue} numberOfLines={2}>
          {normalized}
        </Text>
      </TouchableOpacity>
    );
  };

  const shouldShowRecent = activeField && searchQuery.trim().length < 3;

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <BottomSheet
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        onClose={onClose}
        handleIndicatorStyle={styles.handle}
        backgroundStyle={styles.sheetBackground}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        <BottomSheetView style={styles.sheetContent}>
          <KeyboardAvoidingView
            style={styles.sheetFlex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
          >
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>
                {title ?? (mode === 'stop' ? 'Добавить заезд' : 'Маршрут')}
              </Text>
              <View style={{ width: 20 }} />
            </View>

            <View style={styles.inputContainer}>
              {mode === 'route' ? (
                <>
                  <View style={styles.inputRow}>
                    <BottomSheetTextInput
                      ref={fromInputRef}
                      style={[styles.inputField, styles.inputFieldFlex]}
                      value={fromInputValue}
                      onChangeText={(text) => {
                        setFromInputValue(text);
                        setFromAddress(text);
                        if (activeField === 'from') {
                          setSearchQuery(text);
                        }
                      }}
                      onFocus={() => {
                        setActiveField('from');
                        setSearchQuery(fromInputValue);
                      }}
                      placeholder={fromPlaceholder}
                      placeholderTextColor="#52525B"
                      returnKeyType={toAddress.trim() ? 'done' : 'next'}
                      onSubmitEditing={handleFromSubmit}
                      blurOnSubmit={false}
                    />
                    <TouchableOpacity style={styles.mapPickButton} onPress={() => onMapPick('from')}>
                      <Text style={styles.mapPickButtonText}>Карта</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.divider} />
                </>
              ) : null}

              <View style={styles.inputRow}>
                <BottomSheetTextInput
                  ref={toInputRef}
                  style={[styles.inputField, styles.inputFieldFlex]}
                  placeholder={mode === 'stop' ? 'Адрес заезда...' : toPlaceholder}
                  placeholderTextColor="#52525B"
                  value={mode === 'stop' ? stopAddress : toInputValue}
                  onChangeText={(text) => {
                    if (isStopSelectionMode) {
                      setStopAddress(text);
                    } else {
                      setToInputValue(text);
                      setToAddress(text);
                    }
                    setSearchQuery(text);
                  }}
                  onFocus={() => {
                    setActiveField('to');
                    setSearchQuery(mode === 'stop' ? stopAddress : toInputValue);
                  }}
                  returnKeyType="done"
                  onSubmitEditing={handleToSubmit}
                />
                <TouchableOpacity style={styles.mapPickButton} onPress={() => onMapPick(mode === 'stop' ? 'stop' : 'to')}>
                  <Text style={styles.mapPickButtonText}>Карта</Text>
                </TouchableOpacity>
              </View>
            </View>

            {activeField ? (
              <View style={styles.suggestionsContainer}>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#3B82F6" size="small" />
                    <Text style={styles.loadingText}>Поиск адресов...</Text>
                  </View>
                ) : shouldShowRecent ? (
                  <FlatList
                    data={recentAddresses}
                    renderItem={renderRecentItem}
                    keyExtractor={(item) => `${item.address}-${item.savedAt}`}
                    style={styles.suggestionsList}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    ListHeaderComponent={renderCurrentLocationButton}
                    ListEmptyComponent={<Text style={styles.noResultsText}>Недавних адресов пока нет</Text>}
                  />
                ) : (
                  <FlatList
                    data={searchResults}
                    renderItem={renderSuggestionItem}
                    keyExtractor={(item) => item.place_id}
                    style={styles.suggestionsList}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    ListHeaderComponent={renderCurrentLocationButton}
                    ListEmptyComponent={
                      searchQuery.length >= 3 ? (
                        <View>
                          <Text style={styles.noResultsText}>Адреса не найдены</Text>
                          {renderLandmarkFallback()}
                        </View>
                      ) : null
                    }
                  />
                )}
              </View>
            ) : null}
          </KeyboardAvoidingView>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 500,
    pointerEvents: 'box-none',
  },
  sheetBackground: {
    backgroundColor: '#09090B',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  handle: {
    backgroundColor: '#27272A',
    width: 42,
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  sheetFlex: { flex: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  sheetTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  closeBtn: { color: '#71717A', fontSize: 24 },
  inputContainer: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inputFieldFlex: { flex: 1 },
  inputField: { height: 50, color: '#fff', fontSize: 16 },
  mapPickButton: {
    minWidth: 74,
    height: 38,
    backgroundColor: '#F4F4F5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  mapPickButtonText: { color: '#09090B', fontSize: 13, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#27272A', marginVertical: 4 },
  suggestionsContainer: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    maxHeight: 320,
  },
  suggestionsList: { paddingHorizontal: 12 },
  suggestionItem: { paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  currentLocationButton: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  currentLocationTitle: { color: '#F4F4F5', fontSize: 15, fontWeight: '700' },
  currentLocationSubtitle: { color: '#71717A', fontSize: 12, marginTop: 4 },
  suggestionText: { color: '#E4E4E7', fontSize: 15, fontWeight: '500' },
  suggestionSubText: { color: '#71717A', fontSize: 12, marginTop: 4 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { color: '#71717A', fontSize: 14, marginLeft: 8 },
  noResultsText: { color: '#71717A', fontSize: 14, textAlign: 'center', padding: 20 },
  landmarkButton: {
    marginHorizontal: 12,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  landmarkTitle: {
    color: '#F4F4F5',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  landmarkValue: {
    color: '#A1A1AA',
    fontSize: 14,
    lineHeight: 20,
  },
});
