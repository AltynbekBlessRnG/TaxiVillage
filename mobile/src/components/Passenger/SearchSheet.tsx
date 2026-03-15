import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';

const { height } = Dimensions.get('window');

interface Props {
  anim: Animated.Value;
  fromAddress: string;
  setFromAddress: (t: string) => void;
  toAddress: string;
  setToAddress: (t: string) => void;
  onClose: () => void;
  onMapPick: () => void;
  onSubmit: () => void;
}

export const SearchSheet: React.FC<Props> = ({ 
  anim, fromAddress, setFromAddress, toAddress, setToAddress, onClose, onMapPick, onSubmit 
}) => {
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
          onChangeText={setFromAddress} 
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
            onChangeText={setToAddress} 
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
          <TouchableOpacity onPress={onMapPick}>
            <Text style={{ color: '#3B82F6', fontWeight: '700', padding: 10 }}>Карта</Text>
          </TouchableOpacity>
        </View>
      </View>
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
});