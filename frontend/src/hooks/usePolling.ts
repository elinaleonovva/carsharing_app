import { useEffect, useRef } from "react";

export function usePolling(callback: () => void, intervalMs: number, dependencies: unknown[] = []): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const timer = window.setInterval(() => callbackRef.current(), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, ...dependencies]);
}
