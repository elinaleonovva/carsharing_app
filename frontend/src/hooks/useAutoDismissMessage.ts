import { Dispatch, SetStateAction, useEffect } from "react";

export function useAutoDismissMessage(
  message: string,
  setMessage: Dispatch<SetStateAction<string>>,
  timeoutMs = 12_000,
): void {
  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = window.setTimeout(() => setMessage(""), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [message, setMessage, timeoutMs]);
}
