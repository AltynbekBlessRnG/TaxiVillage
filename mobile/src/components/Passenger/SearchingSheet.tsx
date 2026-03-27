import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Easing } from 'react-native';

const { width } = Dimensions.get('window');

interface Props {
  onCancel: () => void;
  onShowDetails: () => void;
  title?: string;
  cancelLabel?: string;
}

export const SearchingSheet: React.FC<Props> = ({ onCancel, onShowDetails, title = 'Ищем машину...', cancelLabel = 'Отменить\nпоездку' }) => {
  const [seconds, setSeconds] = useState(0);
  
  // Анимация для полоски
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Таймер секунд
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);

    // Циклическая анимация полоски (бегает слева направо)
    Animated.loop(
      Animated.timing(animValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Вычисляем движение полоски
  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 0.5, width], // Полоска выезжает из-за края и уезжает за край
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={styles.timer}>{formatTime(seconds)}</Text>
        </View>

        {/* Анимированная полоска загрузки */}
        <View style={styles.progressBarBg}>
          <Animated.View 
            style={[
              styles.progressBarFill, 
              { transform: [{ translateX }] }
            ]} 
          />
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.circleBtnContainer} onPress={onCancel}>
            <View style={styles.circleBtn}>
              <Text style={styles.btnIcon}>✕</Text>
            </View>
            <Text style={styles.btnLabel}>{cancelLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.circleBtnContainer} onPress={onShowDetails}>
            <View style={styles.circleBtn}>
              <Text style={styles.btnIcon}>☰</Text>
            </View>
            <Text style={styles.btnLabel}>Детали</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 700 },
  content: { backgroundColor: '#121212', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, borderWidth: 1, borderColor: '#27272A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  timer: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
  // Стили полоски
  progressBarBg: { height: 3, backgroundColor: '#27272A', width: '100%', marginBottom: 30, overflow: 'hidden' },
  progressBarFill: { 
    height: '100%', 
    backgroundColor: '#fff', 
    width: '40%', // Длина бегающей линии
    position: 'absolute'
  },

  buttonRow: { flexDirection: 'row', justifyContent: 'center', gap: 40, marginBottom: 25 },
  circleBtnContainer: { alignItems: 'center' },
  circleBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#27272A' },
  btnIcon: { color: '#fff', fontSize: 20 },
  btnLabel: { color: '#71717A', fontSize: 12, textAlign: 'center', marginTop: 8, fontWeight: '500' },
});
