"use client";

import type { PublicKey, Transaction } from "@solana/web3.js";

export interface SolanaProvider {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect?: () => Promise<void>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
}

declare global {
  interface Window {
    solana?: SolanaProvider;
  }
}

export function getInjectedSolanaProvider(): SolanaProvider | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (!window.solana?.isPhantom) {
    return null;
  }
  return window.solana;
}
