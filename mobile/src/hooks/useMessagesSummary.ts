import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';

export interface RideChatThread {
  rideId: string;
  title: string;
  subtitle: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface IntercityChatThread {
  threadType: 'ORDER' | 'BOOKING';
  threadId: string;
  title: string;
  subtitle: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface UseMessagesSummaryOptions {
  autoRefresh?: boolean;
}

const CACHE_TTL_MS = 1500;

let sharedRideThreads: RideChatThread[] = [];
let sharedIntercityThreads: IntercityChatThread[] = [];
let sharedLastLoadedAt = 0;
let sharedRefreshPromise: Promise<void> | null = null;

export function useMessagesSummary(options: UseMessagesSummaryOptions = {}) {
  const { autoRefresh = true } = options;
  const [rideThreads, setRideThreads] = useState<RideChatThread[]>(sharedRideThreads);
  const [intercityThreads, setIntercityThreads] = useState<IntercityChatThread[]>(sharedIntercityThreads);
  const [loading, setLoading] = useState(autoRefresh && sharedLastLoadedAt === 0);

  const syncSharedState = useCallback(() => {
    setRideThreads(sharedRideThreads);
    setIntercityThreads(sharedIntercityThreads);
  }, []);

  const refresh = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && sharedLastLoadedAt > 0 && now - sharedLastLoadedAt < CACHE_TTL_MS) {
      syncSharedState();
      setLoading(false);
      return;
    }

    if (sharedRefreshPromise) {
      setLoading(true);
      await sharedRefreshPromise;
      syncSharedState();
      setLoading(false);
      return;
    }

    setLoading(true);
    sharedRefreshPromise = (async () => {
      const [rideRes, intercityRes] = await Promise.all([
        apiClient.get<{ items: RideChatThread[] }>('/chat/threads').catch(() => ({ data: { items: [] } })),
        apiClient.get<{ items: IntercityChatThread[] }>('/intercity-chat/threads').catch(() => ({ data: { items: [] } })),
      ]);

      sharedRideThreads = Array.isArray(rideRes.data?.items) ? rideRes.data.items : [];
      sharedIntercityThreads = Array.isArray(intercityRes.data?.items) ? intercityRes.data.items : [];
      sharedLastLoadedAt = Date.now();
    })();

    try {
      await sharedRefreshPromise;
      syncSharedState();
    } finally {
      sharedRefreshPromise = null;
      setLoading(false);
    }
  }, [syncSharedState]);

  useEffect(() => {
    if (!autoRefresh) {
      setLoading(false);
      return;
    }

    refresh().catch(() => {});
  }, [autoRefresh, refresh]);

  const unreadCount = useMemo(
    () =>
      [...rideThreads, ...intercityThreads].reduce(
        (sum, thread) => sum + (thread.unreadCount ?? 0),
        0,
      ),
    [intercityThreads, rideThreads],
  );

  return {
    rideThreads,
    intercityThreads,
    unreadCount,
    loading,
    refresh,
  };
}
