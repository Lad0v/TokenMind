/**
 * Solana Wallet Integration Utilities
 * Helpers for working with Solana wallets in the application
 */

import { apiClient } from '@/lib/api-client';

export interface SolanaWallet {
  address: string;
  isValid: boolean;
  network: string;
}

/**
 * Validates a Solana wallet address format
 * Solana addresses are base58 encoded, 32-44 characters long
 */
export function isValidSolanaWallet(address: string): boolean {
  if (!address) return false;

  // Base58 check: Solana addresses use base58 alphabet (no 0, O, I, l characters)
  const base58Regex = /^[1-9A-HJ-NP-Z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * Gets the Phantom wallet if available
 * Phantom is the most common Solana wallet browser extension
 */
export function getPhantomWallet(): any {
  if (typeof window === 'undefined') return null;

  const { solana } = window as any;
  if (solana?.isPhantom) {
    return solana;
  }
  return null;
}

/**
 * Checks if a wallet provider is available
 */
export function isWalletAvailable(): boolean {
  return !!getPhantomWallet();
}

/**
 * Connects to Phantom wallet and returns the public key
 */
export async function connectPhantomWallet(): Promise<string> {
  const wallet = getPhantomWallet();

  if (!wallet) {
    throw new Error(
      'Phantom wallet not found. Please install Phantom: https://phantom.app'
    );
  }

  try {
    const response = await wallet.connect();
    const walletAddress = response.publicKey.toString();

    if (!isValidSolanaWallet(walletAddress)) {
      throw new Error('Invalid wallet address format');
    }

    return walletAddress;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('User rejected')) {
        throw new Error('Wallet connection rejected by user');
      }
    }
    throw error;
  }
}

/**
 * Disconnects from Phantom wallet
 */
export async function disconnectPhantomWallet(): Promise<void> {
  const wallet = getPhantomWallet();

  if (!wallet) {
    return;
  }

  try {
    await wallet.disconnect();
  } catch (error) {
    console.error('Error disconnecting wallet:', error);
  }
}

/**
 * Gets the currently connected wallet address
 */
export async function getConnectedWalletAddress(): Promise<string | null> {
  const wallet = getPhantomWallet();

  if (!wallet) {
    return null;
  }

  try {
    if (wallet.isConnected) {
      return wallet.publicKey?.toString() || null;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Signs a message with the connected wallet
 */
export async function signMessageWithWallet(message: string): Promise<string> {
  const wallet = getPhantomWallet();

  if (!wallet) {
    throw new Error('Phantom wallet not found');
  }

  if (!wallet.isConnected) {
    throw new Error('Wallet not connected');
  }

  try {
    const encodedMessage = new TextEncoder().encode(message);
    const signedMessage = await wallet.signMessage(encodedMessage);
    // Return as hex string
    return Buffer.from(signedMessage.signature).toString('hex');
  } catch (error) {
    if (error instanceof Error && error.message.includes('User rejected')) {
      throw new Error('Message signing rejected by user');
    }
    throw error;
  }
}

/**
 * Complete wallet login flow: connect → sign message → API login
 */
export async function walletAuthFlow(): Promise<{
  walletAddress: string;
  accessToken: string;
  refreshToken: string;
  role: 'investor' | 'issuer' | 'admin';
  isNewUser: boolean;
}> {
  // Step 1: Connect wallet
  const walletAddress = await connectPhantomWallet();

  // Step 2: Login with wallet address
  const loginResponse = await apiClient.loginWithWallet({
    wallet_address: walletAddress,
    network: 'solana',
  });

  return {
    walletAddress,
    accessToken: loginResponse.access_token,
    refreshToken: loginResponse.refresh_token,
    role: loginResponse.role,
    isNewUser: loginResponse.is_new_user,
  };
}

/**
 * Register new user with wallet
 * Called after wallet connection but before first login
 */
export async function registerWithWallet(
  walletAddress: string,
  email: string,
  legalName?: string,
  country?: string
): Promise<{ message: string }> {
  if (!isValidSolanaWallet(walletAddress)) {
    throw new Error('Invalid Solana wallet address');
  }

  return apiClient.register({
    email,
    solana_wallet_address: walletAddress,
    legal_name: legalName,
    country,
  });
}

/**
 * Hook for Phantom wallet connection (listener pattern)
 */
export function setupWalletConnectionListener(
  onConnect: (address: string) => void,
  onDisconnect: () => void
): () => void {
  const wallet = getPhantomWallet();

  if (!wallet) {
    return () => {};
  }

  // Listen for account changes
  wallet.on('accountChanged', (publicKey: any) => {
    if (publicKey) {
      onConnect(publicKey.toString());
    } else {
      onDisconnect();
    }
  });

  // Return cleanup function
  return () => {
    try {
      wallet.off('accountChanged', (publicKey: any) => {
        if (publicKey) {
          onConnect(publicKey.toString());
        } else {
          onDisconnect();
        }
      });
    } catch {
      // Cleanup failed, that's okay
    }
  };
}

/**
 * Get wallet network (mainnet, testnet, devnet)
 */
export function getWalletNetwork(): string {
  const wallet = getPhantomWallet();
  return wallet?.network || 'mainnet-beta';
}

/**
 * Utility to check if running in browser and wallet is available
 */
export function canUseWallet(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return isWalletAvailable();
}

/**
 * Format wallet address for display (truncate middle)
 */
export function formatWalletAddress(address: string, chars = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
