import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Animated, Dimensions, FlatList, ActivityIndicator 
} from 'react-native';
import {
  formatGooglePredictionAddress,
  getGooglePlaceDetails,
  searchGooglePlaces,
} from '../../utils/googleMaps';

const { height } = Dimensions.get('window');

interface GooglePlacePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

interface Props {
  anim: Animated.Value;
  mode: 'route' | 'stop';
  fromAddress: string;
  setFromAddress: (t: string) => void;
  toAddress: string;
  setToAddress: (t: string) => void;
  isStopSelectionMode: boolean; // <-- НОВЫЙ ПРОПС
  userLocation?: { lat: number; lng: number } | null;
  onClose: () => void;
  onMapPick: (field: 'from' | 'to' | 'stop') => void;
  onSubmit: () => void;
  onAddressSelect: (field: 'from' | 'to', address: string, lat: number, lng: number) => void;
}

export const SearchSheet: React.FC<Props> = ({ 
  anim, mode, fromAddress, setFromAddress, toAddress, setToAddress, isStopSelectionMode, userLocation, onClose, onMapPick, onSubmit, onAddressSelect 
}) => {
  const [searchResults, setSearchResults] = useState<GooglePlacePrediction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  
  // Отдельный стейт для текста остановки
  const [stopAddress, setStopAddress] = useState('');

  const toInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (mode === 'stop') {
      setStopAddress('');
      setSearchQuery('');
      setActiveField('to');
      setTimeout(() => toInputRef.current?.focus(), 300);
    }
  }, [mode]);

  const fetchSearchResults = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await searchGooglePlaces(query, userLocation);
      setSearchResults(data);
    } catch (error) {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  const debouncedFetchSearchResults = useCallback(
    (query: string) => {
      const timeoutId = setTimeout(() => fetchSearchResults(query), 800);
      return () => clearTimeout(timeoutId);
    },
    [fetchSearchResults]
  );

  useEffect(() => {
    return debouncedFetchSearchResults(searchQuery);
  }, [searchQuery, debouncedFetchSearchResults]);

  const handleAddressSelect = async (feature: GooglePlacePrediction, field: 'from' | 'to') => {
    setLoading(true);
    try {
      const location = await getGooglePlaceDetails(feature.place_id);
      const shortAddress = formatGooglePredictionAddress(feature);

      onAddressSelect(field, shortAddress, location.lat, location.lng);
      setSearchResults([]);
      setSearchQuery('');
      setActiveField(null);

      if (field === 'to' && !isStopSelectionMode) {
        setTimeout(onSubmit, 100);
      } else if (field === 'from') {
        if (!toAddress.trim()) {
          setTimeout(() => toInputRef.current?.focus(), 100);
        } else {
          setTimeout(onSubmit, 100);
        }
      }
    } catch (error) {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFromChange = (text: string) => {
    setFromAddress(text);
    if (activeField === 'from') setSearchQuery(text);
  };

  const handleToChange = (text: string) => {
    if (isStopSelectionMode) {
      setStopAddress(text);
      setSearchQuery(text);
    } else {
      setToAddress(text);
      setSearchQuery(text);
    }
  };

  const handleFromSubmit = () => {
    if (toAddress.trim().length > 0) onSubmit();
    else toInputRef.current?.focus();
  };

  // Если клиент ввел текст остановки и нажал "Готово" на клавиатуре (без выбора из списка)
  const handleToSubmit = () => {
    if (isStopSelectionMode && stopAddress.trim()) {
      onAddressSelect('to', stopAddress, 0, 0);
      setStopAddress('');
    } else {
      onSubmit();
    }
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

  return (
    <Animated.View style={[styles.zincSearchSheet, { transform: [{ translateY: anim }] }]}>
      <View style={styles.sheetHeader}>
        <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
        <Text style={styles.sheetTitle}>{mode === 'stop' ? 'Добавить заезд' : 'Маршрут'}</Text>
        <View style={{ width: 20 }} />
      </View>
      
      <View style={styles.zincInputContainer}>
        {mode === 'route' && (
          <>
            <View style={styles.inputRow}>
              <TextInput 
                style={[styles.darkInputField, styles.inputFieldFlex]} 
                value={fromAddress} 
                onChangeText={handleFromChange}
                onFocus={() => { setActiveField('from'); setSearchQuery(fromAddress); }}
                placeholder="Откуда?"
                placeholderTextColor="#52525B"
                returnKeyType={toAddress.trim() ? "done" : "next"}
                onSubmitEditing={handleFromSubmit}
                blurOnSubmit={false}
              />
              <TouchableOpacity style={styles.mapPickButton} onPress={() => onMapPick('from')}>
                <Text style={styles.mapPickButtonText}>Карта</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.zincDivider} />
          </>
        )}
        
        <View style={styles.inputRow}>
          <TextInput 
            ref={toInputRef}
            style={[styles.darkInputField, styles.inputFieldFlex]} 
            placeholder={mode === 'stop' ? "Адрес заезда..." : "Куда?"} 
            placeholderTextColor="#52525B" 
            value={mode === 'stop' ? stopAddress : toAddress} 
            onChangeText={handleToChange}
            onFocus={() => { setActiveField('to'); setSearchQuery(mode === 'stop' ? stopAddress : toAddress); }}
            returnKeyType="done"
            onSubmitEditing={handleToSubmit}
          />
          <TouchableOpacity style={styles.mapPickButton} onPress={() => onMapPick(mode === 'stop' ? 'stop' : 'to')}>
            <Text style={styles.mapPickButtonText}>Карта</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeField && (
        <View style={styles.suggestionsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#3B82F6" size="small" />
              <Text style={styles.loadingText}>Поиск адресов...</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              renderItem={renderSuggestionItem}
              keyExtractor={(item) => item.place_id}
              style={styles.suggestionsList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                searchQuery.length >= 3 ? <Text style={styles.noResultsText}>Адреса не найдены</Text> : null
              }
            />
          )}
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  zincSearchSheet: { position: 'absolute', width: '100%', height: height, backgroundColor: '#09090B', borderTopLeftRadius: 32, borderTopRightRadius: 32, zIndex: 500, padding: 24, borderWidth: 1, borderColor: '#27272A' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  sheetTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  closeBtn: { color: '#71717A', fontSize: 24 },
  zincInputContainer: { backgroundColor: '#18181B', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#27272A' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inputFieldFlex: { flex: 1 },
  darkInputField: { height: 50, color: '#fff', fontSize: 16 },
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
  zincDivider: { height: 1, backgroundColor: '#27272A', marginVertical: 4 },
  suggestionsContainer: { backgroundColor: '#18181B', borderRadius: 16, marginTop: 12, borderWidth: 1, borderColor: '#27272A', maxHeight: 250 },
  suggestionsList: { paddingHorizontal: 12 },
  suggestionItem: { paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  suggestionText: { color: '#E4E4E7', fontSize: 15, fontWeight: '500' },
  suggestionSubText: { color: '#71717A', fontSize: 12, marginTop: 4 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { color: '#71717A', fontSize: 14, marginLeft: 8 },
  noResultsText: { color: '#71717A', fontSize: 14, textAlign: 'center', padding: 20 },
});
