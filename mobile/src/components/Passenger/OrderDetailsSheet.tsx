import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';

const { height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  fromAddress: string;
  comment: string;
  stops: Array<{ address: string }>;
  toAddress: string;
  price: string;
}

export const OrderDetailsSheet: React.FC<Props> = ({
  visible, onClose, fromAddress, comment, stops, toAddress, price
}) => {
  const translateY = React.useRef(new Animated.Value(height)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        tension: 50,
        friction: 10,
        useNativeDriver: true
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: height,
        duration: 300,
        useNativeDriver: true
      }).start();
    }
  }, [visible]);

  const formatAddressWithComment = (address: string, comment: string) => {
    return comment ? `${address}, ${comment}` : address;
  };

  const formatDestinationWithStops = (toAddress: string, stops: Array<{ address: string }>) => {
    if (stops.length === 0) return toAddress;
    const stopsText = stops.map(stop => stop.address).join(', ');
    return `${stopsText}, ${toAddress}`;
  };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        
        <View style={styles.header}>
          <Text style={styles.title}>Детали поездки</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Откуда */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.dotBlue} />
              <Text style={styles.sectionTitle}>Откуда</Text>
            </View>
            <Text style={styles.addressText}>
              {formatAddressWithComment(fromAddress, comment)}
            </Text>
          </View>

          {/* Остановки */}
          {stops.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.dotOrange} />
                <Text style={styles.sectionTitle}>Остановки ({stops.length})</Text>
              </View>
              {stops.map((stop, index) => (
                <Text key={index} style={styles.stopText}>
                  {index + 1}. {stop.address}
                </Text>
              ))}
            </View>
          )}

          {/* Куда */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.squareRed} />
              <Text style={styles.sectionTitle}>Куда</Text>
            </View>
            <Text style={styles.addressText}>
              {formatDestinationWithStops(toAddress, stops)}
            </Text>
          </View>

          {/* Цена */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Предложенная цена</Text>
            </View>
            <Text style={styles.priceText}>
              ₸ {price || '0'}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Закрыть</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 800,
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 50,
    borderWidth: 1,
    borderColor: '#27272A',
    height: height * 0.7
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#27272A',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800'
  },
  closeBtn: {
    color: '#71717A',
    fontSize: 24
  },
  content: {
    flex: 1
  },
  section: {
    marginBottom: 25
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 12
  },
  dotBlue: {
    width: 12,
    height: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 6
  },
  dotOrange: {
    width: 12,
    height: 12,
    backgroundColor: '#F97316',
    borderRadius: 6
  },
  squareRed: {
    width: 12,
    height: 12,
    backgroundColor: '#EF4444'
  },
  addressText: {
    color: '#E4E4E7',
    fontSize: 15,
    lineHeight: 20,
    marginLeft: 24
  },
  stopText: {
    color: '#A1A1AA',
    fontSize: 14,
    lineHeight: 18,
    marginLeft: 24,
    marginBottom: 4
  },
  priceText: {
    color: '#3B82F6',
    fontSize: 24,
    fontWeight: '800',
    marginLeft: 24
  },
  closeButton: {
    backgroundColor: '#F4F4F5',
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20
  },
  closeButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '900'
  }
});
