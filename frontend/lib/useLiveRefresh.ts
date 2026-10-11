import { useEffect } from 'react';

export function useLiveRefresh(fn: () => void, enabled: boolean, intervalMs = 30000) {
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(fn, intervalMs);
    return () => clearInterval(id);
  }, [fn, enabled, intervalMs]);
}
