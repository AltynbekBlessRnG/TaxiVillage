import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
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
      Alert.alert('Ошибка', 'Пожалуйста, оцените поездку');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post(`/rides/${rideId}/rate`, { stars: rating });
      
      Alert.alert(
        'Спасибо!',
        'Ваша оценка принята. Водитель будет благодарен!',
        [
          {
            text: 'OK',
            onPress: () => {
              onClose();
              onRatingSubmitted?.();
            },
          },
        ]
      );
    } catch (error) {
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
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Success Icon */}
          <View style={styles.successIcon}>
            <MaterialIcons name="check-circle" size={64} color="#10B981" />
          </View>

          {/* Title */}
          <Text style={styles.modalTitle}>Поездка окончена!</Text>
          
          {/* Price */}
          <Text style={styles.priceText}>К оплате: {finalPrice} ₽</Text>
          
          {/* Driver Info */}
          <Text style={styles.driverText}>Ваш водитель: {driverName}</Text>

          {/* Rating Section */}
          <View style={styles.ratingSection}>
            <Text style={styles.ratingTitle}>Оцените водителя</Text>
            <Text style={styles.ratingSubtitle}>Ваша оценка поможет другим пассажирам</Text>
            
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => handleRating(star)}
                  style={styles.starButton}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={star <= rating ? 'star' : 'star-border'}
                    size={40}
                    color={star <= rating ? '#F59E0B' : '#475569'}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.skipButton]}
              onPress={skipRating}
              disabled={submitting}
            >
              <Text style={styles.skipButtonText}>Пропустить</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.submitButton, rating === 0 && styles.disabledButton]}
              onPress={submitRating}
              disabled={rating === 0 || submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Отправка...' : 'Отправить оценку'}
              </Text>
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    margin: 20,
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
  },
  successIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  priceText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 8,
  },
  driverText: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 24,
    textAlign: 'center',
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  ratingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  ratingSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  skipButton: {
    backgroundColor: '#374151',
  },
  skipButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#10B981',
  },
  disabledButton: {
    backgroundColor: '#475569',
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
