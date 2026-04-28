import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

import type { User } from "../utils/api";
import { api } from "../utils/api";
import { clearStoredToken, getStoredToken, storeToken } from "../utils/storage";

type AuthContextValue = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  setSession: (token: string, user: User) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    api
      .me(token)
      .then(setUser)
      .catch(() => {
        clearStoredToken();
        setToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const setSession = (nextToken: string, nextUser: User) => {
    storeToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
  };

  const logout = async () => {
    if (token) {
      await api.logout(token).catch(() => undefined);
    }

    clearStoredToken();
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ token, user, isLoading, setSession, logout }),
    [token, user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
