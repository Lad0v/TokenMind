'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { clearAuthTokens, loadAuthTokens } from '@/lib/auth-storage';
import type * as types from '@/types/api';

interface AuthContextType {
  user: types.CurrentUserResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: types.UserRole | null;
  login: (walletAddress: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<types.CurrentUserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for stored role
        const storedRole = apiClient.getStoredUserRole();
        
        if (apiClient.hasValidToken()) {
          const currentUser = await apiClient.getCurrentUser();
          setUser(currentUser);
        } else if (storedRole) {
          // Token expired but role exists, clear stored role
          apiClient.clearUserRole();
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        // Token might be invalid, clear it
        // This will be handled by the logout mechanism
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (walletAddress: string) => {
    setIsLoading(true);
    try {
      await apiClient.loginWithWallet({ wallet_address: walletAddress });
      const currentUser = await apiClient.getCurrentUser();
      setUser(currentUser);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      const refreshToken = apiClient.getStoredRefreshToken() ?? loadAuthTokens()?.refreshToken ?? null;
      if (refreshToken) {
        await apiClient.logout(refreshToken);
      } else {
        apiClient.clearStoredAuth();
        clearAuthTokens();
      }
      clearAuthTokens();
      setUser(null);
    } catch (error) {
      console.error('Logout failed, clearing local auth state:', error);
      apiClient.clearStoredAuth();
      clearAuthTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      if (apiClient.hasValidToken()) {
        const currentUser = await apiClient.getCurrentUser();
        setUser(currentUser);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    role: user?.role || null,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
