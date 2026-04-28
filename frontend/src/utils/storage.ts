import { TOKEN_KEY } from "../constants";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(TOKEN_KEY);
}
