import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { apiClient } from '../api/client';

interface RideCompletionModalProps {
  visible: boolean;
  onClose: () => void;
  rideId: string;
  finalPrice: number;
  driverName: string;
  onRatingSubmitted?: () => void;
}

export const RideCompletionModal: React.FC<RideCompletionModalProps> = ({
  visible,
  onClose,
  rideId,
  finalPrice,
  driverName,
  onRatingSubmitted,
}) => {
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleRating = (stars: number) => {
    setRating(stars);
  };

  const submitRating = async () => {
    if (rating === 0) {
      Alert.alert('Ошибка', 'Пожалуйста, поставьте оценку');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post(`/rides/${rideId}/rate`, { stars: rating });
      onClose();
      onRatingSubmitted?.();
    } catch {
      Alert.alert('Ошибка', 'Не удалось отправить оценку');
    } finally {
      setSubmitting(false);
    }
  };

  const skipRating = () => {
    onClose();
    onRatingSubmitted?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={skipRating}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          
          {/* Иконка успеха */}
          <View style={styles.successIconBox}>
            <Text style={styles.successIcon}>✓</Text>
          </View>

          {/* Заголовок и Цена */}
          <Text style={styles.modalTitle}>Поездка завершена</Text>
          <Text style={styles.priceText}>{finalPrice} ₸</Text>
          
          {/* Инфо о водителе */}
          <View style={styles.driverBox}>
            <Text style={styles.driverLabel}>Водитель</Text>
            <Text style={styles.driverText}>{driverName}</Text>
          </View>

          {/* Блок оценки */}
          <View style={styles.ratingSection}>
            <Text style={styles.ratingTitle}>Оцените поездку</Text>
            
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => handleRating(star)}
                  style={styles.starButton}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.starIcon, 
                    { color: star <= rating ? '#F59E0B' : '#27272A' }
                  ]}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Кнопки */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.submitButton, rating === 0 && styles.disabledButton]}
              onPress={submitRating}
              disabled={rating === 0 || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.submitButtonText}>Отправить оценку</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={skipRating}
              disabled={submitting}
            >
              <Text style={styles.skipButtonText}>Пропустить</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#18181B',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#27272A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
  },
  successIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  successIcon: {
    color: '#10B981',
    fontSize: 32,
    fontWeight: '900',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F4F4F5',
    marginBottom: 8,
    textAlign: 'center',
  },
  priceText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#10B981',
    marginBottom: 24,
  },
  driverBox: {
    backgroundColor: '#09090B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#27272A',
    width: '100%',
  },
  driverLabel: {
    fontSize: 12,
    color: '#71717A',
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 4,
  },
  driverText: {
    fontSize: 16,
    color: '#F4F4F5',
    fontWeight: '600',
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 32,
    width: '100%',
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#A1A1AA',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  starIcon: {
    fontSize: 44,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  submitButton: {
    backgroundColor: '#F4F4F5',
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    width: '100%',
  },
  disabledButton: {
    backgroundColor: '#27272A',
  },
  submitButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '800',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#71717A',
    fontSize: 16,
    fontWeight: '600',
  },
});