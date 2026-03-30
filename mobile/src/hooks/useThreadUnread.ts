import { useMemo } from 'react';
import { useMessagesSummary } from './useMessagesSummary';

export function useThreadUnread() {
  const { rideThreads, intercityThreads, unreadCount, loading, refresh } = useMessagesSummary();

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
