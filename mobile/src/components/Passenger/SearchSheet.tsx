import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Dimensions, FlatList, ActivityIndicator } from 'react-native';

const { height } = Dimensions.get('window');

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name: string;
    street?: string;
    housenumber?: string;
    city?: string;
    postcode?: string;
  };
}

interface Props {
  anim: Animated.Value;
  fromAddress: string;
  setFromAddress: (t: string) => void;
  toAddress: string;
  setToAddress: (t: string) => void;
  onClose: () => void;
  onMapPick: () => void;
  onSubmit: () => void;
  onAddressSelect: (field: 'from' | 'to', address: string, lat: number, lng: number) => void;
}

export const SearchSheet: React.FC<Props> = ({ 
  anim, fromAddress, setFromAddress, toAddress, setToAddress, onClose, onMapPick, onSubmit, onAddressSelect 
}) => {
  const [searchResults, setSearchResults] = useState<PhotonFeature[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);

  const fetchSearchResults = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=ru`);
      const data = await response.json();
      setSearchResults(data.features || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedFetchSearchResults = useCallback(
    (query: string) => {
      const timeoutId = setTimeout(() => fetchSearchResults(query), 300);
      return () => clearTimeout(timeoutId);
    },
    [fetchSearchResults]
  );

  useEffect(() => {
    return debouncedFetchSearchResults(searchQuery);
  }, [searchQuery, debouncedFetchSearchResults]);

  const handleAddressSelect = (feature: PhotonFeature, field: 'from' | 'to') => {
    const { street, housenumber, city, postcode, name } = feature.properties;
    let address = '';
    
    if (street && housenumber) {
      address = `${street} ${housenumber}`;
    } else if (street) {
      address = street;
    } else if (name) {
      address = name;
    }
    
    if (city) {
      address += address ? `, ${city}` : city;
    }
    
    if (postcode) {
      address += address ? ` ${postcode}` : postcode;
    }

    const [lng, lat] = feature.geometry.coordinates;
    onAddressSelect(field, address, lat, lng);
    setSearchResults([]);
    setSearchQuery('');
    setActiveField(null);
    
    // Auto-proceed to ORDER_SETUP if "to" field is selected
    if (field === 'to') {
      setTimeout(onSubmit, 100);
    }
  };

  const handleFromFocus = () => {
    setActiveField('from');
    setSearchQuery(fromAddress);
  };

  const handleToFocus = () => {
    setActiveField('to');
    setSearchQuery(toAddress);
  };

  const handleFromChange = (text: string) => {
    setFromAddress(text);
    if (activeField === 'from') {
      setSearchQuery(text);
    }
  };

  const handleToChange = (text: string) => {
    setToAddress(text);
    if (activeField === 'to') {
      setSearchQuery(text);
    }
  };

  const renderSuggestionItem = ({ item }: { item: PhotonFeature }) => {
    const { street, housenumber, city, name } = item.properties;
    let displayText = '';
    
    if (street && housenumber) {
      displayText = `${street} ${housenumber}`;
    } else if (street) {
      displayText = street;
    } else if (name) {
      displayText = name;
    }
    
    if (city) {
      displayText += displayText ? `, ${city}` : city;
    }

    return (
      <TouchableOpacity
        style={styles.suggestionItem}
        onPress={() => handleAddressSelect(item, activeField!)}
      >
        <Text style={styles.suggestionText}>{displayText}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View style={[styles.zincSearchSheet, { transform: [{ translateY: anim }] }]}>
      <View style={styles.sheetHeader}>
        <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
        <Text style={styles.sheetTitle}>Маршрут</Text>
        <View style={{ width: 20 }} />
      </View>
      <View style={styles.zincInputContainer}>
        <TextInput 
          style={styles.darkInputField} 
          value={fromAddress} 
          onChangeText={handleFromChange}
          onFocus={handleFromFocus}
          placeholderTextColor="#52525B"
          returnKeyType="next"
        />
        <View style={styles.zincDivider} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput 
            style={{ flex: 1, height: 50, color: '#fff', fontSize: 16 }} 
            placeholder="Куда?" 
            placeholderTextColor="#52525B" 
            value={toAddress} 
            onChangeText={handleToChange}
            onFocus={handleToFocus}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
          <TouchableOpacity onPress={onMapPick}>
            <Text style={{ color: '#3B82F6', fontWeight: '700', padding: 10 }}>Карта</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Autocomplete results */}
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
              keyExtractor={(item, index) => `${item.geometry.coordinates[0]}-${item.geometry.coordinates[1]}-${index}`}
              style={styles.suggestionsList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                searchQuery.length >= 3 ? (
                  <Text style={styles.noResultsText}>Адреса не найдены</Text>
                ) : null
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
  suggestionsContainer: { backgroundColor: '#18181B', borderRadius: 16, marginTop: 12, borderWidth: 1, borderColor: '#27272A', maxHeight: 200 },
  suggestionsList: { paddingHorizontal: 12 },
  suggestionItem: { paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  suggestionText: { color: '#E4E4E7', fontSize: 15 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { color: '#71717A', fontSize: 14, marginLeft: 8 },
  noResultsText: { color: '#71717A', fontSize: 14, textAlign: 'center', padding: 20 },
});