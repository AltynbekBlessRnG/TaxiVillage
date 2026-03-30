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

export function useMessagesSummary() {
  const [rideThreads, setRideThreads] = useState<RideChatThread[]>([]);
  const [intercityThreads, setIntercityThreads] = useState<IntercityChatThread[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [rideRes, intercityRes] = await Promise.all([
        apiClient.get<{ items: RideChatThread[] }>('/chat/threads').catch(() => ({ data: { items: [] } })),
        apiClient.get<{ items: IntercityChatThread[] }>('/intercity-chat/threads').catch(() => ({ data: { items: [] } })),
      ]);

      setRideThreads(Array.isArray(rideRes.data?.items) ? rideRes.data.items : []);
      setIntercityThreads(Array.isArray(intercityRes.data?.items) ? intercityRes.data.items : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

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
