import { useMemo } from 'react';
import { useMessagesSummary } from './useMessagesSummary';

interface UseThreadUnreadOptions {
  autoRefresh?: boolean;
}

export function useThreadUnread(options: UseThreadUnreadOptions = {}) {
  const { rideThreads, intercityThreads, unreadCount, loading, refresh } = useMessagesSummary(options);

  const rideUnreadById = useMemo(
    () =>
      rideThreads.reduce<Record<string, number>>((acc, thread) => {
        acc[thread.rideId] = thread.unreadCount ?? 0;
        return acc;
      }, {}),
    [rideThreads],
  );

  const intercityUnreadByThread = useMemo(
    () =>
      intercityThreads.reduce<Record<string, number>>((acc, thread) => {
        acc[`${thread.threadType}:${thread.threadId}`] = thread.unreadCount ?? 0;
        return acc;
      }, {}),
    [intercityThreads],
  );

  return {
    unreadCount,
    loading,
    refresh,
    rideUnreadById,
    intercityUnreadByThread,
  };
}
