import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DriverStatusSheetProps {
  isOnline: boolean;
  currentRideId: string | null;
  currentRide?: any;
  profile: any;
  onSwitchMode: (mode: 'TAXI' | 'COURIER') => void;
  onOpenToday?: () => void;
  currentCourierOrder?: any;
  availableCourierOrders?: any[];
  onAcceptCourierOrder?: (orderId: string) => void;
  onRideStatusChange?: (status: string) => void;
  onCompleteRide?: () => void;
  onCancelRide?: () => void;
  onOpenRideChat?: () => void;
  onCallPassenger?: () => void;
  onCourierStatusChange?: (status: string) => void;
  onShowDriverNotice?: (title: string, message: string) => void;
  metrics?: {
    todayEarnings?: number;
    dailyBuckets?: Array<{ date: string; label: string; earnings: number }>;
    completedTaxiRides?: number;
    completedCourierDeliveries?: number;
    rating?: number;
    balance?: number;
  } | null;
}

export const DriverStatusSheet: React.FC<DriverStatusSheetProps> = ({
  isOnline,
  currentRideId,
  currentRide,
  profile,
  onSwitchMode,
  onOpenToday,
  currentCourierOrder,
  availableCourierOrders = [],
  onAcceptCourierOrder,
  onRideStatusChange,
  onCompleteRide,
  onCancelRide,
  onOpenRideChat,
  onCallPassenger,
  onCourierStatusChange,
  onShowDriverNotice,
  metrics,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [isWaitingExpanded, setIsWaitingExpanded] = useState(false);
  const [isActiveExpanded, setIsActiveExpanded] = useState(false);
  const maxEarnings = Math.max(...(metrics?.dailyBuckets?.map((bucket) => bucket.earnings) ?? [0]), 1);

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

  useEffect(() => {
    if (currentRide || currentCourierOrder) {
      setIsActiveExpanded(false);
    }
  }, [currentRide, currentCourierOrder]);

  if (currentRide || currentCourierOrder) {
    const rideStatus = currentRide?.status;
    const courierStatus = currentCourierOrder?.status;
    const compactActions = currentRide
      ? buildRideActions({
          rideStatus,
          onRideStatusChange,
          onCompleteRide,
          onCancelRide,
          onOpenRideChat,
          onCallPassenger,
          onShowDriverNotice,
          hasPassengerPhone: !!currentRide?.passenger?.user?.phone,
        })
      : buildCourierActions({
          courierStatus,
          onCourierStatusChange,
        });
    const iconActions = compactActions.filter((action) => action.placement === 'icon');
    const primaryAction = compactActions.find((action) => action.placement === 'primary');
    const cancelAction = compactActions.find((action) => action.placement === 'cancel');

    return (
      <View style={styles.container}>
        <View style={styles.workspace}>
          <View style={[styles.activeCard, currentCourierOrder && styles.activeCardCourier]}>
            <View style={styles.handleLineActive} />
            <TouchableOpacity
              style={styles.activeSummaryBar}
              onPress={() => setIsActiveExpanded((prev) => !prev)}
              activeOpacity={0.9}
            >
              <View style={styles.activeSummaryMain}>
                <Text style={styles.activeSummaryTime}>
                  {rideStatus === 'IN_PROGRESS' || courierStatus === 'TO_RECIPIENT' ? 'В пути' : 'Подача'}
                </Text>
                <Text style={styles.activeSummaryAddress} numberOfLines={1}>
                  {currentRide?.fromAddress || currentCourierOrder?.pickupAddress || '-'}
                </Text>
              </View>
              <View style={styles.activeSummarySide}>
                <Text style={[styles.activeSummaryPrice, currentCourierOrder && styles.activeSummaryPriceCourier]}>
                  {Math.round(
                    Number(
                      currentRide?.finalPrice ??
                        currentRide?.estimatedPrice ??
                        currentCourierOrder?.estimatedPrice ??
                        0,
                    ),
                  )}{' '}
                  ₸
                </Text>
                <Text style={styles.activeSummaryChevron}>{isActiveExpanded ? '⌄' : '⌃'}</Text>
              </View>
            </TouchableOpacity>

            {isActiveExpanded ? (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.activeExpandedRow}>
                  <View style={styles.activeExpandedMain}>
                    {currentRide ? (
                      <View style={styles.routeCardActive}>
                        <View style={styles.routePointCompact}>
                          <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
                          <View style={styles.routeTextWrap}>
                            <Text style={styles.routeText}>{currentRide?.fromAddress || '-'}</Text>
                            {currentRide?.pickupLocationPrecision === 'LANDMARK_TEXT' ? (
                              <View style={styles.precisionBadge}>
                                <Text style={styles.precisionBadgeText}>Ориентир</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        {(currentRide?.stops ?? []).length > 0 || currentRide?.toAddress ? (
                          <View style={styles.routeArrowWrap}>
                            <Ionicons name="arrow-down" size={16} color="#5F5F68" />
                          </View>
                        ) : null}
                        {(currentRide?.stops ?? []).map((stop: any, index: number) => (
                          <React.Fragment key={`${stop.address}-${index}`}>
                            <View style={styles.routePointCompact}>
                              <View style={[styles.dot, { backgroundColor: '#F97316' }]} />
                              <Text style={styles.routeText}>{stop.address}</Text>
                            </View>
                            <View style={styles.routeArrowWrap}>
                              <Ionicons name="arrow-down" size={16} color="#5F5F68" />
                            </View>
                          </React.Fragment>
                        ))}
                        <View style={styles.routePointCompact}>
                          <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                          <View style={styles.routeTextWrap}>
                            <Text style={styles.routeText}>{currentRide?.toAddress || '-'}</Text>
                            {currentRide?.dropoffLocationPrecision === 'LANDMARK_TEXT' ? (
                              <View style={styles.precisionBadge}>
                                <Text style={styles.precisionBadgeText}>Ориентир</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    ) : null}

                    {currentCourierOrder ? (
                      <View style={styles.routeCardActive}>
                        <View style={styles.routePointCompact}>
                          <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
                          <Text style={styles.routeText}>{currentCourierOrder?.pickupAddress || '-'}</Text>
                        </View>
                        <View style={styles.routeArrowWrap}>
                          <Ionicons name="arrow-down" size={16} color="#5F5F68" />
                        </View>
                        <View style={styles.routePointCompact}>
                          <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                          <Text style={styles.routeText}>{currentCourierOrder?.dropoffAddress || '-'}</Text>
                        </View>
                        {currentCourierOrder?.itemDescription ? (
                          <Text style={styles.courierMiniMeta}>{currentCourierOrder.itemDescription}</Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>

                  {iconActions.length > 0 ? (
                    <View style={styles.actionIconColumn}>
                      {iconActions.map((action) => (
                        <TouchableOpacity
                          key={action.label}
                          style={styles.actionIconBtn}
                          onPress={action.onPress}
                        >
                          <Ionicons name={action.icon} size={22} color="#F4F4F5" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>

                {primaryAction && cancelAction ? (
                  <View style={styles.bottomActionRow}>
                    <TouchableOpacity
                      style={[
                        styles.bottomHalfAction,
                        primaryAction.tone === 'success'
                          ? styles.bottomHalfActionSuccess
                          : styles.bottomHalfActionPrimary,
                      ]}
                      onPress={primaryAction.onPress}
                    >
                      <Ionicons
                        name={primaryAction.icon}
                        size={18}
                        color={primaryAction.tone === 'success' ? '#062117' : '#04131A'}
                        style={styles.bottomPrimaryIcon}
                      />
                      <Text
                        style={[
                          styles.bottomHalfActionText,
                          primaryAction.tone === 'success' && styles.bottomHalfActionTextSuccess,
                        ]}
                      >
                        {primaryAction.label}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.bottomHalfActionCancel} onPress={cancelAction.onPress}>
                      <Text style={styles.bottomHalfActionCancelText}>{cancelAction.label}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {primaryAction && !cancelAction ? (
                  <TouchableOpacity
                    style={[
                      styles.bottomPrimaryFull,
                      primaryAction.tone === 'success' && styles.bottomPrimaryFullSuccess,
                    ]}
                    onPress={primaryAction.onPress}
                  >
                    <Ionicons
                      name={primaryAction.icon}
                      size={18}
                      color={primaryAction.tone === 'success' ? '#062117' : '#04131A'}
                      style={styles.bottomPrimaryIcon}
                    />
                    <Text
                      style={[
                        styles.bottomPrimaryFullText,
                        primaryAction.tone === 'success' && styles.bottomPrimaryFullTextSuccess,
                      ]}
                    >
                      {primaryAction.label}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.workspace}>
        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.modeTab, profile?.driverMode === 'TAXI' && styles.modeTabActive]}
            onPress={() => onSwitchMode('TAXI')}
            disabled={profile?.driverMode === 'TAXI'}
            activeOpacity={profile?.driverMode === 'TAXI' ? 1 : 0.85}
          >
            <Text style={[styles.modeTabText, profile?.driverMode === 'TAXI' && styles.modeTabTextActive]}>
              Такси
            </Text>
          </TouchableOpacity>
          {profile?.supportsCourier ? (
            <TouchableOpacity
              style={[styles.modeTab, profile?.driverMode === 'COURIER' && styles.modeTabActiveCourier]}
              onPress={() => onSwitchMode('COURIER')}
              disabled={profile?.driverMode === 'COURIER'}
              activeOpacity={profile?.driverMode === 'COURIER' ? 1 : 0.85}
            >
              <Text style={[styles.modeTabText, profile?.driverMode === 'COURIER' && styles.modeTabTextActive]}>
                Курьер
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        
        {isOnline ? (
          <View style={styles.onlineShell}>
            <View style={styles.onlineBar}>
              <View style={styles.handleLine} />
              <TouchableOpacity
                style={styles.onlineCenter}
                onPress={() => setIsWaitingExpanded((prev) => !prev)}
                activeOpacity={0.88}
              >
                <View style={styles.onlineCenterTop}>
                  <Animated.View style={[styles.onlineDot, { opacity: pulseAnim }]} />
                  <Text style={styles.onlineTitle}>Вы в сети</Text>
                </View>
                <Text style={[styles.onlineSubtitle, profile?.driverMode === 'COURIER' ? styles.onlineSubtitleCourier : styles.onlineSubtitleTaxi]}>
                  Сегодня {Math.round(Number(metrics?.todayEarnings ?? 0))} ₸
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.expandToggle}
                onPress={() => setIsWaitingExpanded((prev) => !prev)}
                activeOpacity={0.88}
              >
                {profile?.driverMode === 'COURIER' && availableCourierOrders.length > 0 ? (
                  <View style={styles.radarCountBadge}>
                    <Text style={styles.radarCountText}>{availableCourierOrders.length}</Text>
                  </View>
                ) : null}
                <Text style={styles.expandToggleText}>{isWaitingExpanded ? '⌄' : '☰'}</Text>
              </TouchableOpacity>
            </View>

            {isWaitingExpanded ? (
              <View style={styles.waitingPanel}>
                <View style={styles.infoCardCompact}>
                  <TouchableOpacity
                    style={styles.infoHeaderRow}
                    onPress={() => setIsStatsExpanded((prev) => !prev)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.infoHeader}>
                      <Text style={styles.infoTitle}>7 дней</Text>
                      {!isStatsExpanded ? (
                        <Text style={styles.infoSummary}>
                          Сегодня {Math.round(Number(metrics?.todayEarnings ?? 0))} ₸
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.infoChevron}>{isStatsExpanded ? '⌃' : '⌄'}</Text>
                  </TouchableOpacity>
                  {isStatsExpanded ? (
                    <View style={styles.chartRow}>
                      {(metrics?.dailyBuckets ?? []).map((bucket) => (
                        <View key={bucket.date} style={styles.chartItem}>
                          <View style={styles.chartTrack}>
                            <View
                              style={[
                                styles.chartBar,
                                {
                                  height: `${Math.max(8, Math.round((bucket.earnings / maxEarnings) * 100))}%`,
                                  backgroundColor: profile?.driverMode === 'COURIER' ? '#F59E0B' : '#3B82F6',
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.chartValue}>{Math.round(bucket.earnings)}</Text>
                          <Text style={styles.chartLabel}>{bucket.label}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity style={styles.card} onPress={onOpenToday}>
                  <Text style={styles.cardTitle}>Сегодня</Text>
                  <View style={styles.cardRight}>
                    <Text style={styles.cardValue}>{Math.round(Number(metrics?.todayEarnings ?? 0))} ₸</Text>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.metricsCard}>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Баланс</Text>
                    <Text style={styles.metricValueWhite}>{Math.round(Number(metrics?.balance ?? profile?.balance ?? 0))} ₸</Text>
                  </View>
                  
                  <View style={styles.verticalDivider} />
                  
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Завершено</Text>
                    <Text style={styles.metricValueWhite}>
                      {(metrics?.completedTaxiRides ?? 0) + (metrics?.completedCourierDeliveries ?? 0)}
                    </Text>
                  </View>
                  
                  <View style={styles.verticalDivider} />
                  
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Рейтинг</Text>
                    <Text style={styles.metricValueYellow}>{Number(metrics?.rating ?? profile?.rating ?? 5).toFixed(1)} ★</Text>
                  </View>
                </View>

                {profile?.driverMode === 'COURIER' && availableCourierOrders.length > 0 ? (
                  <View style={styles.offerBlockCompact}>
                    {availableCourierOrders.slice(0, 2).map((order) => (
                      <TouchableOpacity key={order.id} style={styles.offerCard} onPress={() => onAcceptCourierOrder?.(order.id)}>
                        <Text style={styles.offerRoute}>{order.pickupAddress}</Text>
                        <Text style={styles.offerMeta}>
                          {order.dropoffAddress} • {Math.round(Number(order.estimatedPrice || 0))} ₸
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 },
  workspace: { 
    backgroundColor: '#09090B', 
    padding: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#2F2F35',
    shadowColor: '#000',
    shadowOpacity: 0.26,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 18,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 6,
    gap: 6,
    marginBottom: 14,
  },
  modeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
  },
  modeTabActive: {
    backgroundColor: '#082F49',
    borderWidth: 1,
    borderColor: '#0EA5E9',
  },
  modeTabActiveCourier: {
    backgroundColor: '#3F2B05',
  },
  modeTabText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '800',
  },
  modeTabTextActive: {
    color: '#F4F4F5',
  },
  
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, justifyContent: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  statusText: { color: '#F4F4F5', fontSize: 15, fontWeight: '600' },
  onlineShell: {
    marginBottom: 14,
  },
  onlineBar: {
    minHeight: 74,
    borderRadius: 20,
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: '#2A2A30',
    paddingTop: 18,
    paddingBottom: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  onlineCenter: {
    justifyContent: 'center',
    flex: 1,
    marginRight: 10,
  },
  onlineCenterTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  onlineTitle: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '900',
  },
  onlineSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  onlineSubtitleTaxi: {
    color: '#60A5FA',
  },
  onlineSubtitleCourier: {
    color: '#FACC15',
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 40,
  },
  radarCountBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radarCountText: {
    color: '#03131C',
    fontSize: 12,
    fontWeight: '900',
  },
  expandToggleText: {
    color: '#A1A1AA',
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 6,
  },
  handleLine: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -21,
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#3A3A40',
  },
  waitingPanel: {
    backgroundColor: '#09090B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#24242A',
    padding: 14,
    marginTop: 10,
  },
  offerBlockCompact: {
    marginTop: 10,
  },

  infoCard: {
    backgroundColor: '#18181B',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  infoCardCompact: {
    backgroundColor: '#18181B',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  infoHeader: {
    flex: 1,
  },
  infoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoTitle: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
  },
  infoChevron: {
    color: '#A1A1AA',
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 12,
  },
  infoSummary: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  infoText: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 18,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 8,
  },
  chartItem: {
    flex: 1,
    alignItems: 'center',
  },
  chartTrack: {
    width: '100%',
    height: 72,
    borderRadius: 12,
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#27272A',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 6,
  },
  chartBar: {
    width: '100%',
    borderRadius: 10,
    minHeight: 6,
  },
  chartValue: {
    color: '#F4F4F5',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },
  chartLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  card: { 
    backgroundColor: '#18181B', 
    borderRadius: 18, 
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
  
  metricsCard: {
    backgroundColor: '#18181B', 
    borderRadius: 18, 
    height: 76,
    flexDirection: 'row', 
    justifyContent: 'space-evenly',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A'
  },
  offerBlock: {
    marginBottom: 14,
  },
  offerTitle: {
    color: '#F4F4F5',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  offerCard: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  offerRoute: {
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  offerMeta: {
    color: '#A1A1AA',
    fontSize: 13,
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

  activeCard: { backgroundColor: '#09090B', paddingHorizontal: 14, paddingTop: 18, paddingBottom: 14, borderRadius: 20, borderWidth: 1, borderColor: '#27272A' },
  activeCardCourier: { backgroundColor: '#09090B', borderColor: '#27272A' },
  handleLineActive: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#3A3A40',
    marginBottom: 12,
  },
  activeSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeSummaryMain: {
    flex: 1,
    marginRight: 12,
  },
  activeSummaryTime: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  activeSummaryAddress: {
    color: '#F4F4F5',
    fontSize: 16,
    fontWeight: '800',
  },
  activeSummarySide: {
    alignItems: 'flex-end',
  },
  activeSummaryPrice: {
    color: '#60A5FA',
    fontSize: 20,
    fontWeight: '900',
  },
  activeSummaryPriceCourier: {
    color: '#FACC15',
  },
  activeSummaryChevron: {
    color: '#71717A',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  routeCardActive: {
    paddingTop: 2,
  },
  summaryDivider: {
    height: 2,
    backgroundColor: '#F4F4F5',
    borderRadius: 999,
    marginTop: 12,
    marginBottom: 12,
    opacity: 0.95,
  },
  routeArrowWrap: {
    marginLeft: 22,
    marginVertical: 4,
  },
  activeExpandedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  activeExpandedMain: {
    flex: 1,
    marginRight: 12,
  },
  routePointCompact: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  routeTextWrap: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  routeText: { color: '#E4E4E7', fontSize: 14, flex: 1, fontWeight: '600' },
  precisionBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  precisionBadgeText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  courierMiniMeta: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  actionIconColumn: {
    width: 56,
    alignItems: 'center',
    gap: 10,
    paddingTop: 6,
  },
  actionIconBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2C2C33',
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 10,
  },
  bottomHalfAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  bottomHalfActionPrimary: {
    backgroundColor: '#0EA5E9',
  },
  bottomHalfActionSuccess: {
    backgroundColor: '#10B981',
  },
  bottomHalfActionCancel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#2B1114',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  bottomHalfActionText: {
    color: '#04131A',
    fontSize: 14,
    fontWeight: '900',
  },
  bottomHalfActionTextSuccess: {
    color: '#062117',
  },
  bottomHalfActionCancelText: {
    color: '#F87171',
    fontSize: 14,
    fontWeight: '900',
  },
  bottomPrimaryFull: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#0EA5E9',
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  bottomPrimaryFullSuccess: {
    backgroundColor: '#10B981',
  },
  bottomPrimaryIcon: {
    marginRight: 8,
  },
  bottomPrimaryFullText: {
    color: '#04131A',
    fontSize: 15,
    fontWeight: '900',
  },
  bottomPrimaryFullTextSuccess: {
    color: '#062117',
  },
});

function buildRideActions({
  rideStatus,
  onRideStatusChange,
  onCompleteRide,
  onCancelRide,
  onOpenRideChat,
  onCallPassenger,
  onShowDriverNotice,
  hasPassengerPhone,
}: {
  rideStatus?: string;
  onRideStatusChange?: (status: string) => void;
  onCompleteRide?: () => void;
  onCancelRide?: () => void;
  onOpenRideChat?: () => void;
  onCallPassenger?: () => void;
  onShowDriverNotice?: (title: string, message: string) => void;
  hasPassengerPhone: boolean;
}) {
  const actions: Array<{
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    tone: 'default' | 'primary' | 'success' | 'danger';
    placement?: 'icon' | 'primary' | 'cancel';
    onPress?: () => void;
  }> =
    [];

  if (rideStatus === 'ON_THE_WAY' || rideStatus === 'DRIVER_ASSIGNED') {
    actions.push({
      label: 'На месте',
      icon: 'paper-plane-outline',
      tone: 'primary',
      placement: 'primary',
      onPress: () => {
        onRideStatusChange?.('DRIVER_ARRIVED');
        onShowDriverNotice?.('Вы на месте', 'Клиент получил уведомление, что вы подъехали.');
      },
    });
  }

  if (rideStatus === 'DRIVER_ARRIVED') {
    actions.push({ label: 'В путь', icon: 'paper-plane-outline', tone: 'primary', placement: 'primary', onPress: () => onRideStatusChange?.('IN_PROGRESS') });
  }

  if (rideStatus === 'IN_PROGRESS') {
    actions.push({ label: 'Завершить', icon: 'checkmark-outline', tone: 'success', placement: 'primary', onPress: onCompleteRide });
  }

  if (hasPassengerPhone) {
    actions.push({ label: 'Позвонить', icon: 'call-outline', tone: 'default', placement: 'icon', onPress: onCallPassenger });
  }

  actions.push({ label: 'Чат', icon: 'chatbubble-ellipses-outline', tone: 'default', placement: 'icon', onPress: onOpenRideChat });

  if (rideStatus === 'ON_THE_WAY' || rideStatus === 'DRIVER_ASSIGNED' || rideStatus === 'DRIVER_ARRIVED') {
    actions.push({ label: 'Отменить заказ', icon: 'close-outline', tone: 'danger', placement: 'cancel', onPress: onCancelRide });
  }

  return actions.filter((action) => !!action.onPress);
}

function buildCourierActions({
  courierStatus,
  onCourierStatusChange,
}: {
  courierStatus?: string;
  onCourierStatusChange?: (status: string) => void;
}) {
  const actions: Array<{
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    tone: 'default' | 'primary' | 'success' | 'danger';
    placement?: 'icon' | 'primary' | 'cancel';
    onPress?: () => void;
  }> =
    [];

  if (courierStatus === 'TO_PICKUP') {
    actions.push({ label: 'На месте', icon: 'paper-plane-outline', tone: 'primary', placement: 'primary', onPress: () => onCourierStatusChange?.('COURIER_ARRIVED') });
  }

  if (courierStatus === 'COURIER_ARRIVED' || courierStatus === 'PICKED_UP') {
    actions.push({ label: 'К получателю', icon: 'paper-plane-outline', tone: 'primary', placement: 'primary', onPress: () => onCourierStatusChange?.('TO_RECIPIENT') });
  }

  if (courierStatus === 'TO_RECIPIENT' || courierStatus === 'DELIVERING') {
    actions.push({ label: 'Доставлено', icon: 'checkmark-outline', tone: 'success', placement: 'primary', onPress: () => onCourierStatusChange?.('DELIVERED') });
  }

  return actions.filter((action) => !!action.onPress);
}
