"use client";

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { apiClient } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/api/users";
import type { UserDoc } from "@/lib/entities";

type UserContextValue = {
  user: UserDoc | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

const UserContext = createContext<UserContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
});

export function useUser() {
  return useContext(UserContext);
}

type UserProviderProps = {
  children: ReactNode;
  initialUser?: UserDoc | null;
};

const CACHE_TTL = 30000;

export function UserProvider({ children, initialUser }: UserProviderProps) {
  const [user, setUser] = useState<UserDoc | null>(initialUser ?? null);
  const [isLoading, setIsLoading] = useState(!initialUser);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
      setIsLoading(false);
      lastFetchRef.current = Date.now();
      return;
    }

    const fetchUser = async () => {
      const now = Date.now();
      if (now - lastFetchRef.current < CACHE_TTL) return;

      lastFetchRef.current = now;
      try {
        const userData = await getCurrentUser(apiClient);
        setUser(userData);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [initialUser]);

  return (
    <UserContext.Provider value={{ user, isLoading, isAuthenticated: !!user }}>
      {children}
    </UserContext.Provider>
  );
}
