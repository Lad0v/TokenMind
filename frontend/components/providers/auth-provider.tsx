"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { apiClient, AuthMeResponse, RegisterPayload } from "@/lib/api-client";
import { getInjectedSolanaProvider } from "@/lib/solana/provider";
import { clearStoredSession, readStoredSession, writeStoredSession } from "@/lib/session";

type AuthContextValue = {
  user: AuthMeResponse | null;
  accessToken: string | null;
  refreshToken: string | null;
  walletAddress: string | null;
  isReady: boolean;
  isAuthenticating: boolean;
  connectWallet: () => Promise<string>;
  loginWithWallet: () => Promise<AuthMeResponse>;
  registerInvestor: (payload: RegisterPayload) => Promise<AuthMeResponse>;
  refreshUser: () => Promise<AuthMeResponse | null>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthMeResponse | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    const session = readStoredSession();
    setAccessToken(session.accessToken);
    setRefreshToken(session.refreshToken);

    const provider = getInjectedSolanaProvider();
    if (provider?.publicKey) {
      setWalletAddress(provider.publicKey.toString());
    }

    const bootstrap = async () => {
      if (!session.accessToken) {
        setIsReady(true);
        return;
      }

      try {
        const me = await apiClient.getCurrentUser(session.accessToken);
        setUser(me);
      } catch {
        clearStoredSession();
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
      } finally {
        setIsReady(true);
      }
    };

    void bootstrap();
  }, []);

  const connectWallet = async () => {
    const provider = getInjectedSolanaProvider();
    if (!provider) {
      throw new Error("Phantom wallet was not found in this browser");
    }

    const response = await provider.connect();
    const address = response.publicKey.toString();
    setWalletAddress(address);
    return address;
  };

  const refreshUser = async () => {
    if (!accessToken) {
      return null;
    }
    try {
      const me = await apiClient.getCurrentUser(accessToken);
      setUser(me);
      return me;
    } catch {
      clearStoredSession();
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
      return null;
    }
  };

  const loginWithWallet = async () => {
    setIsAuthenticating(true);
    try {
      const connectedWallet = walletAddress ?? (await connectWallet());
      const tokens = await apiClient.loginWithWallet(connectedWallet);
      writeStoredSession(tokens.access_token, tokens.refresh_token);
      setAccessToken(tokens.access_token);
      setRefreshToken(tokens.refresh_token);
      const me = await apiClient.getCurrentUser(tokens.access_token);
      setUser(me);
      return me;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const registerInvestor = async (payload: RegisterPayload) => {
    setIsAuthenticating(true);
    try {
      const connectedWallet = walletAddress ?? (await connectWallet());
      await apiClient.registerInvestor({ ...payload, walletAddress: connectedWallet });
      return await loginWithWallet();
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = () => {
    clearStoredSession();
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  const value: AuthContextValue = {
    user,
    accessToken,
    refreshToken,
    walletAddress,
    isReady,
    isAuthenticating,
    connectWallet,
    loginWithWallet,
    registerInvestor,
    refreshUser,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used inside <AuthProvider>");
  }
  return context;
}
