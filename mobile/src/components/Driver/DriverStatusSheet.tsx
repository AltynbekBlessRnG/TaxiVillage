import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';

interface DriverStatusSheetProps {
  isOnline: boolean;
  currentRideId: string | null;
  profile: any;
  onGoToRide: () => void;
}

const getWeekDays = () => {
  const daysOfWeek = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push({
      id: i,
      date: d.getDate(),
      name: daysOfWeek[d.getDay()],
      isToday: i === 0,
      progress: i === 0 ? 15 : Math.floor(Math.random() * 60) + 10, 
    });
  }
  return result;
};

export const DriverStatusSheet: React.FC<DriverStatusSheetProps> = ({ isOnline, currentRideId, profile, onGoToRide }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const weekDays = useMemo(() => getWeekDays(), []);

  useEffect(() => {
    if (isOnline && !currentRideId) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.2, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOnline, currentRideId]);

  if (currentRideId) {
    return (
      <View style={styles.container}>
        <View style={styles.workspace}>
          <TouchableOpacity style={styles.activeCard} onPress={onGoToRide}>
            <View style={styles.row}>
              <View style={styles.dotGreen} />
              <Text style={styles.activeText}>У вас активный заказ!</Text>
            </View>
            <Text style={styles.subText}>Нажмите, чтобы открыть карту поездки</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.workspace}>
        
        {/* СТАТУС */}
        <View style={styles.statusRow}>
          <Animated.View style={[styles.dot, { backgroundColor: isOnline ? '#10B981' : '#71717A', opacity: pulseAnim }]} />
          <Text style={styles.statusText}>
            {isOnline ? 'Поиск заказов...' : 'Офлайн — отдых'}
          </Text>
        </View>

        {/* ГРАФИК ЗА НЕДЕЛЮ */}
        <View style={styles.chartRow}>
          {weekDays.map((day) => (
            <View key={day.id} style={styles.dayColumn}>
              <View style={styles.progressBarBg}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { width: `${day.progress}%`, backgroundColor: day.isToday ? '#3B82F6' : '#52525B' }
                  ]} 
                />
              </View>
              <Text style={[styles.dayDate, day.isToday && styles.textBlue]}>{day.date}</Text>
              <Text style={[styles.dayName, day.isToday && styles.textBlue]}>{day.name}</Text>
            </View>
          ))}
        </View>

        {/* КАРТОЧКА "СЕГОДНЯ" */}
        <TouchableOpacity style={styles.card}>
          <Text style={styles.cardTitle}>Сегодня</Text>
          <View style={styles.cardRight}>
            <Text style={styles.cardValue}>0 ₸</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </TouchableOpacity>

        {/* КАРТОЧКА "МЕТРИКИ" (Баланс, Активность, Рейтинг) */}
        <View style={styles.metricsCard}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Баланс</Text>
            <Text style={styles.metricValueWhite}>{profile?.balance ?? 0} ₸</Text>
          </View>
          
          <View style={styles.verticalDivider} />
          
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Активность</Text>
            <Text style={styles.metricValueWhite}>100</Text>
          </View>
          
          <View style={styles.verticalDivider} />
          
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Рейтинг</Text>
            <Text style={styles.metricValueYellow}>{(profile?.rating ?? 5.0).toFixed(1)} ★</Text>
          </View>
        </View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 },
  workspace: { 
    backgroundColor: '#09090B', 
    padding: 16, // Уменьшили отступы, чтобы всё влезло
    paddingBottom: 24, // Уменьшили нижний отступ
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    borderTopWidth: 1, 
    borderColor: '#27272A' 
  },
  
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  statusText: { color: '#F4F4F5', fontSize: 15, fontWeight: '600' },

  chartRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 5 },
  dayColumn: { alignItems: 'center', width: '13%' },
  progressBarBg: { width: '100%', height: 4, backgroundColor: '#27272A', borderRadius: 2, marginBottom: 8, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2 },
  dayDate: { color: '#F4F4F5', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  dayName: { color: '#71717A', fontSize: 11, fontWeight: '500' },
  textBlue: { color: '#3B82F6' },

  card: { 
    backgroundColor: '#18181B', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 10, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A'
  },
  cardTitle: { color: '#F4F4F5', fontSize: 16, fontWeight: '600' },
  cardRight: { flexDirection: 'row', alignItems: 'center' },
  cardValue: { color: '#F4F4F5', fontSize: 18, fontWeight: '800' },
  chevron: { color: '#71717A', fontSize: 22, marginLeft: 10, marginTop: -2 },
  
  // Стили для новой тройной карточки
  // Стили для новой тройной карточки (ЖЕЛЕЗОБЕТОННЫЕ)
  metricsCard: {
    backgroundColor: '#18181B', 
    borderRadius: 16, 
    height: 76, // Жестко фиксируем высоту, чтобы она не растягивалась
    flexDirection: 'row', 
    justifyContent: 'space-evenly', // Равномерно распределяем
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A'
  },
  metricBox: { 
    width: '30%', // Жестко задаем ширину вместо flex: 1
    alignItems: 'center',
    justifyContent: 'center'
  },
  verticalDivider: { 
    width: 1, 
    height: 36, 
    backgroundColor: '#27272A' 
  },
  metricLabel: { 
    color: '#71717A', 
    fontSize: 11, 
    textTransform: 'uppercase', 
    marginBottom: 4, 
    fontWeight: '600' 
  },
  metricValueWhite: { 
    color: '#F4F4F5', 
    fontSize: 16, 
    fontWeight: '800' 
  },
  metricValueYellow: { 
    color: '#F59E0B', 
    fontSize: 16, 
    fontWeight: '800' 
  },

  activeCard: { backgroundColor: '#10B981', padding: 20, borderRadius: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', marginRight: 10 },
  activeText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  subText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, textAlign: 'center', fontWeight: '500' }
});
