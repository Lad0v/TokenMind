'use client'

const DEFAULT_SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
const LAMPORTS_PER_SOL = 1_000_000_000

interface PhantomPublicKeyLike {
  toString: () => string
}

interface PhantomSignatureResponse {
  publicKey: PhantomPublicKeyLike
  signature: Uint8Array
}

interface PhantomTransactionResponse {
  signature: Uint8Array | string
}

export interface PhantomProvider {
  isPhantom?: boolean
  isConnected?: boolean
  publicKey?: PhantomPublicKeyLike | null
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PhantomPublicKeyLike }>
  signMessage?: (message: Uint8Array, display?: 'utf8' | 'hex') => Promise<PhantomSignatureResponse>
  signTransaction?: (transaction: unknown) => Promise<{
    serialize: () => Uint8Array
  }>
  signAndSendTransaction?: (transaction: unknown) => Promise<PhantomTransactionResponse>
  disconnect?: () => Promise<void>
  on?: (
    event: 'connect' | 'disconnect' | 'accountChanged',
    listener: (publicKey?: PhantomPublicKeyLike | null) => void,
  ) => void
  off?: (
    event: 'connect' | 'disconnect' | 'accountChanged',
    listener: (publicKey?: PhantomPublicKeyLike | null) => void,
  ) => void
}

declare global {
  interface Window {
    solana?: PhantomProvider
    phantom?: {
      solana?: PhantomProvider
    }
  }
}

export function getSolanaRpcUrl() {
  return DEFAULT_SOLANA_RPC_URL
}

export function getPhantomProvider() {
  if (typeof window === 'undefined') {
    return null
  }

  const provider = window.phantom?.solana ?? window.solana
  if (provider?.isPhantom) {
    return provider
  }

  return null
}

export function formatWalletAddress(address?: string | null) {
  if (!address) {
    return 'Not connected'
  }

  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

export async function getSolanaBalance(address: string, rpcUrl = getSolanaRpcUrl()) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [address, { commitment: 'confirmed' }],
    }),
  })

  const payload = (await response.json()) as {
    error?: { message?: string }
    result?: { value?: number }
  }

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? 'Failed to fetch Solana balance')
  }

  return Number(((payload.result?.value ?? 0) / LAMPORTS_PER_SOL).toFixed(4))
}

function toBase64(bytes: Uint8Array) {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

export async function signPhantomMessage(message: string, provider = getPhantomProvider()) {
  if (!provider) {
    throw new Error('Phantom wallet is not available in this browser.')
  }
  if (!provider.signMessage) {
    throw new Error('This Phantom provider does not support message signing.')
  }

  const encodedMessage = new TextEncoder().encode(message)
  const response = await provider.signMessage(encodedMessage, 'utf8')
  const signatureBase64 = toBase64(response.signature)
  const walletAddress = response.publicKey?.toString() ?? provider.publicKey?.toString()

  if (!walletAddress) {
    throw new Error('Phantom wallet address is unavailable after signing.')
  }

  return {
    walletAddress,
    signature: signatureBase64,
  }
}
