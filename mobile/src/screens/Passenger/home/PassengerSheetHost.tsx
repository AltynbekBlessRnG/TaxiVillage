import React, { useMemo, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SearchSheet } from '../../../components/Passenger/SearchSheet';
import { ConfirmationSheet } from '../../../components/Passenger/ConfirmationSheet';
import { SearchingSheet } from '../../../components/Passenger/SearchingSheet';
import { SearchingDetailsSheet } from '../../../components/Passenger/SearchingDetailsSheet';
import { ActiveOrderSheet } from '../../../components/Passenger/ActiveOrderSheet';
import type { PassengerCoordinates, PassengerScreenState, PassengerStop } from './usePassengerFlowStore';

interface Props {
  screenState: PassengerScreenState;
  activeService: 'Такси' | 'Курьер' | 'Еда' | 'Межгород';
  loading: boolean;
  fromAddress: string;
  toAddress: string;
  fromCoord: PassengerCoordinates | null;
  toCoord: PassengerCoordinates | null;
  fromLocationPrecision: 'EXACT' | 'LANDMARK_TEXT';
  toLocationPrecision: 'EXACT' | 'LANDMARK_TEXT';
  offeredPrice: string;
  comment: string;
  stops: PassengerStop[];
  isStopSelectionMode: boolean;
  showSearchingDetails: boolean;
  mapPickTarget: 'from' | 'to' | 'stop';
  searchMode: 'route' | 'stop';
  searchInitialField: 'from' | 'to';
  courierItemDescription: string;
  courierPackageWeight: string;
  courierPackageSize: string;
  userLocation?: PassengerCoordinates | null;
  activeRide: any;
  activeCourierOrder: any;
  etaSeconds?: number | null;
  rideUnreadCount: number;
  mapCenter?: PassengerCoordinates | null;
  onCloseSearch: () => void;
  onMapPickStart: (field: 'from' | 'to' | 'stop') => void;
  onSearchSubmit: () => void;
  onAddressSelect: (field: 'from' | 'to', address: string, lat: number, lng: number) => void;
  onCustomLandmarkSelect: (field: 'from' | 'to', address: string) => void;
  onDestinationReady: () => void;
  onMapPickConfirm: () => Promise<void>;
  onOrder: () => void;
  onEditAddress: () => void;
  onOrderSetupClose: () => void;
  setPrice: (value: string) => void;
  setComment: (value: string) => void;
  onRequestAddStop: () => void;
  onRemoveStop: (index: number) => void;
  setItemDescription: (value: string) => void;
  setPackageWeight: (value: string) => void;
  setPackageSize: (value: string) => void;
  onCancelSearching: () => void;
  onShowSearchingDetails: () => void;
  onHideSearchingDetails: () => void;
  onOpenRideChat?: () => void;
}

const hasValidCoordinates = (coords?: PassengerCoordinates | null) =>
  !!coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng) && !(coords.lat === 0 && coords.lng === 0);

export const PassengerSheetHost: React.FC<Props> = ({
  screenState,
  activeService,
  loading,
  fromAddress,
  toAddress,
  fromCoord: _fromCoord,
  toCoord,
  fromLocationPrecision,
  toLocationPrecision,
  offeredPrice,
  comment,
  stops,
  isStopSelectionMode,
  showSearchingDetails,
  mapPickTarget: _mapPickTarget,
  searchMode,
  searchInitialField,
  courierItemDescription,
  courierPackageWeight,
  courierPackageSize,
  userLocation,
  activeRide,
  activeCourierOrder,
  etaSeconds,
  rideUnreadCount,
  onCloseSearch,
  onMapPickStart,
  onSearchSubmit,
  onAddressSelect,
  onCustomLandmarkSelect,
  onDestinationReady,
  onMapPickConfirm,
  onOrder,
  onEditAddress,
  onOrderSetupClose,
  setPrice,
  setComment,
  onRequestAddStop,
  onRemoveStop,
  setItemDescription,
  setPackageWeight,
  setPackageSize,
  onCancelSearching,
  onShowSearchingDetails,
  onHideSearchingDetails,
  onOpenRideChat,
}) => {
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSearchingRide =
    activeRide?.status === 'SEARCHING_DRIVER' || activeCourierOrder?.status === 'SEARCHING_COURIER';
  const cancelTitle = useMemo(
    () => (activeService === 'Курьер' ? 'Отменить доставку?' : 'Отменить поездку?'),
    [activeService],
  );
  const cancelDescription = useMemo(
    () =>
      activeService === 'Курьер'
        ? 'Мы прекратим поиск курьера для этого заказа.'
        : 'Мы прекратим поиск водителя для этого заказа.',
    [activeService],
  );

  const handleOrderPress = async () => {
    try {
      await onOrder();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось выполнить действие');
    }
  };

  const handleConfirmCancel = async () => {
    setCancelConfirmVisible(false);
    try {
      await onCancelSearching();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось отменить заказ');
    }
  };

  return (
    <>
      <SearchSheet
        visible={screenState === 'SEARCH'}
        initialField={searchInitialField}
        mode={searchMode}
        fromAddress={fromAddress}
        setFromAddress={() => {}}
        toAddress={toAddress}
        setToAddress={() => {}}
        isStopSelectionMode={isStopSelectionMode}
        userLocation={userLocation}
        onClose={onCloseSearch}
        onMapPick={onMapPickStart}
        onSubmit={onSearchSubmit}
        onAddressSelect={onAddressSelect}
        onCustomLandmarkSelect={onCustomLandmarkSelect}
        onDestinationReady={onDestinationReady}
        fromPlaceholder={activeService === 'Курьер' ? 'Откуда забрать?' : 'Откуда?'}
        toPlaceholder={activeService === 'Курьер' ? 'Куда доставить?' : 'Куда?'}
        title={searchMode === 'stop' ? 'Добавить заезд' : activeService === 'Курьер' ? 'Доставка' : 'Маршрут'}
      />

      {screenState === 'MAP_PICK' ? (
        <View style={styles.confirmMapPick}>
          <TouchableOpacity style={styles.zincMainBtn} onPress={() => void onMapPickConfirm()}>
            <Text style={styles.zincMainBtnText}>Готово</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {screenState === 'ORDER_SETUP' ? (
        <ConfirmationSheet
          serviceType={activeService === 'Курьер' ? 'courier' : 'taxi'}
          fromAddress={fromAddress}
          toAddress={toAddress}
          fromLocationPrecision={fromLocationPrecision}
          toLocationPrecision={toLocationPrecision}
          price={offeredPrice}
          setPrice={setPrice}
          onOrder={() => {
            void handleOrderPress();
          }}
          onEditAddress={onEditAddress}
          onSwipeDown={onOrderSetupClose}
          loading={loading}
          comment={comment}
          setComment={setComment}
          stops={stops}
          onAddStop={() => {
            if (!toAddress || !toCoord) {
              Alert.alert('Сначала укажите адрес', 'Сначала выберите, куда едем, а потом добавляйте заезд.');
              return;
            }
            onRequestAddStop();
          }}
          isAddStopDisabled={!hasValidCoordinates(toCoord)}
          onRemoveStop={onRemoveStop}
          itemDescription={courierItemDescription}
          setItemDescription={setItemDescription}
          packageWeight={courierPackageWeight}
          setPackageWeight={setPackageWeight}
          packageSize={courierPackageSize}
          setPackageSize={setPackageSize}
        />
      ) : null}

      {screenState === 'SEARCHING' ? (
        activeRide || activeCourierOrder ? (
          isSearchingRide ? (
            <>
              <SearchingSheet
                onCancel={() => setCancelConfirmVisible(true)}
                onShowDetails={onShowSearchingDetails}
                title={activeService === 'Курьер' ? 'Ищем курьера...' : 'Ищем водителя'}
              />
              <SearchingDetailsSheet
                visible={showSearchingDetails}
                fromAddress={fromAddress}
                toAddress={toAddress}
                comment={comment}
                stops={stops}
                price={offeredPrice}
                onClose={onHideSearchingDetails}
              />
            </>
          ) : (
            <ActiveOrderSheet
              activeRide={activeRide}
              activeCourierOrder={activeCourierOrder}
              etaSeconds={etaSeconds}
              rideUnreadCount={rideUnreadCount}
              onCancel={() => setCancelConfirmVisible(true)}
              onOpenRideChat={onOpenRideChat}
            />
          )
        ) : (
          <SearchingSheet
            onCancel={() => setCancelConfirmVisible(true)}
            onShowDetails={onShowSearchingDetails}
            title={activeService === 'Курьер' ? 'Ищем курьера...' : 'Ищем водителя'}
          />
        )
      ) : null}

      {!activeRide && !activeCourierOrder && screenState === 'SEARCHING' ? (
        <SearchingDetailsSheet
          visible={showSearchingDetails}
          fromAddress={fromAddress}
          toAddress={toAddress}
          comment={comment}
          stops={stops}
          price={offeredPrice}
          onClose={onHideSearchingDetails}
        />
      ) : null}

      <Modal visible={cancelConfirmVisible} transparent animationType="fade" onRequestClose={() => setCancelConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{cancelTitle}</Text>
            <Text style={styles.modalBody}>{cancelDescription}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondary} onPress={() => setCancelConfirmVisible(false)}>
                <Text style={styles.modalSecondaryText}>Назад</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDanger} onPress={() => void handleConfirmCancel()}>
                <Text style={styles.modalDangerText}>Отменить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!errorMessage} transparent animationType="fade" onRequestClose={() => setErrorMessage(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ошибка</Text>
            <Text style={styles.modalBody}>{errorMessage}</Text>
            <TouchableOpacity style={styles.modalPrimary} onPress={() => setErrorMessage(null)}>
              <Text style={styles.modalPrimaryText}>Понятно</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  confirmMapPick: { position: 'absolute', bottom: 50, left: 20, right: 20, zIndex: 100 },
  zincMainBtn: {
    backgroundColor: '#F4F4F5',
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zincMainBtnText: { color: '#000', fontSize: 18, fontWeight: '800' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#111113',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 20,
  },
  modalTitle: {
    color: '#F4F4F5',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  modalBody: {
    color: '#A1A1AA',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '700',
  },
  modalDanger: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#991B1B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDangerText: {
    color: '#FEE2E2',
    fontSize: 15,
    fontWeight: '800',
  },
  modalPrimary: {
    height: 50,
    borderRadius: 16,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: {
    color: '#09090B',
    fontSize: 15,
    fontWeight: '800',
  },
});
