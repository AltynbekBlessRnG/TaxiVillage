import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Animated, Dimensions, FlatList, ActivityIndicator 
} from 'react-native';

const { height } = Dimensions.get('window');

interface OSMFeature {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
}

interface Props {
  anim: Animated.Value;
  fromAddress: string;
  setFromAddress: (t: string) => void;
  toAddress: string;
  setToAddress: (t: string) => void;
  isStopSelectionMode: boolean; // <-- НОВЫЙ ПРОПС
  onClose: () => void;
  onMapPick: () => void;
  onSubmit: () => void;
  onAddressSelect: (field: 'from' | 'to', address: string, lat: number, lng: number) => void;
}

export const SearchSheet: React.FC<Props> = ({ 
  anim, fromAddress, setFromAddress, toAddress, setToAddress, isStopSelectionMode, onClose, onMapPick, onSubmit, onAddressSelect 
}) => {
  const [searchResults, setSearchResults] = useState<OSMFeature[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  
  // Отдельный стейт для текста остановки
  const [stopAddress, setStopAddress] = useState('');

  const toInputRef = useRef<TextInput>(null);

  // Если включился режим добавления остановки — очищаем поле и сразу открываем клавиатуру
  useEffect(() => {
    if (isStopSelectionMode) {
      setStopAddress('');
      setSearchQuery('');
      setActiveField('to');
      setTimeout(() => toInputRef.current?.focus(), 300);
    }
  }, [isStopSelectionMode]);

  const fetchSearchResults = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=ru`,
        { headers: { 'User-Agent': 'TaxiVillageApp/1.0' } }
      );
      const data = await response.json();
      setSearchResults(data || []);
    } catch (error) {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleAddressSelect = (feature: OSMFeature, field: 'from' | 'to') => {
    const parts = feature.display_name.split(', ');
    const shortAddress = parts.slice(0, 2).join(', ');
    const lat = parseFloat(feature.lat);
    const lng = parseFloat(feature.lon);
    
    onAddressSelect(field, shortAddress, lat, lng);
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

  const renderSuggestionItem = ({ item }: { item: OSMFeature }) => {
    const parts = item.display_name.split(', ');
    const mainText = parts[0];
    const subText = parts.slice(1, 3).join(', ');

    return (
      <TouchableOpacity style={styles.suggestionItem} onPress={() => handleAddressSelect(item, activeField!)}>
        <Text style={styles.suggestionText}>{mainText}</Text>
        {subText ? <Text style={styles.suggestionSubText}>{subText}</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View style={[styles.zincSearchSheet, { transform: [{ translateY: anim }] }]}>
      <View style={styles.sheetHeader}>
        <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
        <Text style={styles.sheetTitle}>{isStopSelectionMode ? 'Добавить заезд' : 'Маршрут'}</Text>
        <View style={{ width: 20 }} />
      </View>
      
      <View style={styles.zincInputContainer}>
        <TextInput 
          style={styles.darkInputField} 
          value={fromAddress} 
          onChangeText={handleFromChange}
          onFocus={() => { setActiveField('from'); setSearchQuery(fromAddress); }}
          placeholder="Откуда?"
          placeholderTextColor="#52525B"
          returnKeyType={toAddress.trim() ? "done" : "next"}
          onSubmitEditing={handleFromSubmit}
          blurOnSubmit={false}
          editable={!isStopSelectionMode} // Блокируем поле "Откуда", если ищем остановку
        />
        
        <View style={styles.zincDivider} />
        
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput 
            ref={toInputRef}
            style={{ flex: 1, height: 50, color: '#fff', fontSize: 16 }} 
            placeholder={isStopSelectionMode ? "Адрес заезда..." : "Куда?"} 
            placeholderTextColor="#52525B" 
            value={isStopSelectionMode ? stopAddress : toAddress} 
            onChangeText={handleToChange}
            onFocus={() => { setActiveField('to'); setSearchQuery(isStopSelectionMode ? stopAddress : toAddress); }}
            returnKeyType="done"
            onSubmitEditing={handleToSubmit}
          />
          <TouchableOpacity onPress={onMapPick}>
            <Text style={{ color: '#3B82F6', fontWeight: '700', padding: 10 }}>Карта</Text>
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
              keyExtractor={(item) => item.place_id.toString()}
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
  darkInputField: { height: 50, color: '#fff', fontSize: 16 },
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