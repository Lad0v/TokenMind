'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  connectPhantomWallet,
  disconnectPhantomWallet,
  getConnectedWalletAddress,
  isWalletAvailable,
  walletAuthFlow,
  registerWithWallet,
  setupWalletConnectionListener,
  isValidSolanaWallet,
} from '@/lib/wallet-helper';
import { getUserFriendlyErrorMessage } from '@/lib/error-handler';

export interface UseWalletState {
  walletAddress: string | null;
  isConnected: boolean;
  isLoading: boolean;
  isAvailable: boolean;
  error: string | null;
}

/**
 * Hook to manage Phantom wallet connection
 */
export function useWallet() {
  const [state, setState] = useState<UseWalletState>({
    walletAddress: null,
    isConnected: false,
    isLoading: true,
    // Keep SSR and the first client render identical; detect wallet availability after mount.
    isAvailable: false,
    error: null,
  });

  // Initialize wallet connection state
  useEffect(() => {
    const initWallet = async () => {
      try {
        const walletAvailable = isWalletAvailable();
        const connectedAddress = await getConnectedWalletAddress();
        setState((prev) => ({
          ...prev,
          walletAddress: connectedAddress,
          isConnected: !!connectedAddress,
          isLoading: false,
          isAvailable: walletAvailable,
        }));
      } catch (error) {
        const walletAvailable = isWalletAvailable();
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isAvailable: walletAvailable,
        }));
      }
    };

    initWallet();
  }, []);

  // Setup wallet connection listener
  useEffect(() => {
    if (!state.isAvailable) return;

    const cleanup = setupWalletConnectionListener(
      (address) => {
        setState((prev) => ({
          ...prev,
          walletAddress: address,
          isConnected: true,
          error: null,
        }));
      },
      () => {
        setState((prev) => ({
          ...prev,
          walletAddress: null,
          isConnected: false,
          error: null,
        }));
      }
    );

    return cleanup;
  }, [state.isAvailable]);

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const address = await connectPhantomWallet();
      setState((prev) => ({
        ...prev,
        walletAddress: address,
        isConnected: true,
        isLoading: false,
        error: null,
      }));
      return address;
    } catch (error) {
      const errorMessage = getUserFriendlyErrorMessage(error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  const disconnect = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      await disconnectPhantomWallet();
      setState((prev) => ({
        ...prev,
        walletAddress: null,
        isConnected: false,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      const errorMessage = getUserFriendlyErrorMessage(error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  return {
    ...state,
    connect,
    disconnect,
  };
}

/**
 * Hook for wallet-based authentication
 */
export function useWalletAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { walletAddress, connect } = useWallet();

  const login = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await walletAuthFlow();
      return result;
    } catch (err) {
      const errorMessage = getUserFriendlyErrorMessage(err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (email: string, legalName?: string, country?: string) => {
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      setError(null);
      try {
        const result = await registerWithWallet(
          walletAddress,
          email,
          legalName,
          country
        );
        return result;
      } catch (err) {
        const errorMessage = getUserFriendlyErrorMessage(err);
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [walletAddress]
  );

  const ensureConnected = useCallback(async () => {
    if (!walletAddress) {
      return connect();
    }
    return walletAddress;
  }, [walletAddress, connect]);

  return {
    walletAddress,
    loading,
    error,
    login,
    register,
    ensureConnected,
  };
}

/**
 * Hook to validate wallet address
 */
export function useWalletValidation(address: string | null) {
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    if (address) {
      setIsValid(isValidSolanaWallet(address));
    } else {
      setIsValid(false);
    }
  }, [address]);

  return { isValid };
}

/**
 * Hook to monitor wallet balance (requires connection to Solana RPC)
 * This is a placeholder - actual implementation would require a Solana web3.js connection
 */
export function useWalletBalance(walletAddress: string | null) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!walletAddress) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [walletAddress],
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.status}`);
      }

      const payload = await response.json();
      const lamports = payload?.result?.value;
      if (typeof lamports !== 'number') {
        throw new Error('Invalid balance response');
      }

      setBalance(lamports / 1_000_000_000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch balance'
      );
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, loading, error, refresh };
}
