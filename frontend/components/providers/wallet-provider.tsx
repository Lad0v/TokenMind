'use client'

import * as React from 'react'

import { useSession } from '@/components/providers/session-provider'
import { type UserWallet } from '@/lib/api'
import { getPhantomProvider, getSolanaBalance, getSolanaRpcUrl } from '@/lib/phantom'

type ProviderStatus = 'checking' | 'ready' | 'unsupported'

interface WalletContextValue {
  providerStatus: ProviderStatus
  rpcUrl: string
  connectedAddress: string | null
  displayAddress: string | null
  balanceSOL: number | null
  wallets: UserWallet[]
  primaryWallet: UserWallet | null
  isConnecting: boolean
  isUpdating: boolean
  connect: () => Promise<string | null>
  disconnect: () => Promise<void>
  refreshWallets: () => Promise<void>
  linkConnectedWallet: () => Promise<UserWallet | null>
  unlinkWallet: (walletId: string) => Promise<void>
}

const WalletContext = React.createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const [providerStatus, setProviderStatus] = React.useState<ProviderStatus>('checking')
  const [connectedAddress, setConnectedAddress] = React.useState<string | null>(null)
  const [wallets, setWallets] = React.useState<UserWallet[]>([])
  const [balanceSOL, setBalanceSOL] = React.useState<number | null>(null)
  const [isConnecting, setIsConnecting] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const rpcUrl = React.useMemo(() => getSolanaRpcUrl(), [])

  const primaryWallet = React.useMemo(
    () => wallets.find((wallet) => wallet.is_primary) ?? wallets[0] ?? null,
    [wallets],
  )

  const displayAddress = connectedAddress ?? primaryWallet?.wallet_address ?? null

  const buildLocalWallet = React.useCallback((address: string): UserWallet => {
    const now = new Date().toISOString()
    return {
      id: `local-${address}`,
      wallet_address: address,
      network: 'solana',
      is_primary: true,
      created_at: now,
      updated_at: now,
    }
  }, [])

  const refreshWallets = React.useCallback(async () => {
    if (status !== 'authenticated') {
      setWallets([])
      return
    }

    if (!connectedAddress) {
      setWallets([])
      return
    }

    setWallets([buildLocalWallet(connectedAddress)])
  }, [buildLocalWallet, connectedAddress, status])

  React.useEffect(() => {
    const provider = getPhantomProvider()
    if (!provider) {
      setProviderStatus('unsupported')
      return
    }

    setProviderStatus('ready')

    const syncProviderAddress = (publicKey?: { toString: () => string } | null) => {
      const nextAddress = publicKey?.toString() ?? provider.publicKey?.toString() ?? null
      setConnectedAddress(nextAddress)
    }
    const handleDisconnect = () => setConnectedAddress(null)

    syncProviderAddress(provider.publicKey)

    provider.on?.('connect', syncProviderAddress)
    provider.on?.('accountChanged', syncProviderAddress)
    provider.on?.('disconnect', handleDisconnect)

    return () => {
      provider.off?.('connect', syncProviderAddress)
      provider.off?.('accountChanged', syncProviderAddress)
      provider.off?.('disconnect', handleDisconnect)
    }
  }, [])

  React.useEffect(() => {
    if (status === 'authenticated') {
      void refreshWallets()
      return
    }

    setWallets([])
  }, [refreshWallets, status])

  React.useEffect(() => {
    if (!displayAddress) {
      setBalanceSOL(null)
      return
    }

    let cancelled = false
    void getSolanaBalance(displayAddress, rpcUrl)
      .then((nextBalance) => {
        if (!cancelled) {
          setBalanceSOL(nextBalance)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBalanceSOL(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [displayAddress, rpcUrl])

  const connect = React.useCallback(async () => {
    const provider = getPhantomProvider()
    if (!provider) {
      throw new Error('Phantom wallet is not available in this browser.')
    }

    setIsConnecting(true)
    try {
      const response = await provider.connect()
      const address = response.publicKey.toString()
      setConnectedAddress(address)
      return address
    } catch (caughtError) {
      if (
        caughtError instanceof Error &&
        caughtError.message.toLowerCase().includes('disconnected port')
      ) {
        throw new Error('Phantom временно недоступен. Откройте расширение и попробуйте снова.')
      }

      throw caughtError
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnect = React.useCallback(async () => {
    const provider = getPhantomProvider()
    try {
      await provider?.disconnect?.()
    } finally {
      setConnectedAddress(null)
    }
  }, [])

  const linkConnectedWallet = React.useCallback(async () => {
    if (status !== 'authenticated') {
      throw new Error('Sign in before linking a wallet.')
    }
    if (!connectedAddress) {
      throw new Error('Connect Phantom before linking a wallet.')
    }

    setIsUpdating(true)
    try {
      const wallet = buildLocalWallet(connectedAddress)
      setWallets([wallet])
      await refreshWallets()
      return wallet
    } finally {
      setIsUpdating(false)
    }
  }, [buildLocalWallet, connectedAddress, refreshWallets, status])

  const unlinkWallet = React.useCallback(async (walletId: string) => {
    if (status !== 'authenticated') {
      throw new Error('Sign in before unlinking a wallet.')
    }

    setIsUpdating(true)
    try {
      setWallets((currentWallets) => currentWallets.filter((wallet) => wallet.id !== walletId))
    } finally {
      setIsUpdating(false)
    }
  }, [status])

  const value = React.useMemo<WalletContextValue>(
    () => ({
      providerStatus,
      rpcUrl,
      connectedAddress,
      displayAddress,
      balanceSOL,
      wallets,
      primaryWallet,
      isConnecting,
      isUpdating,
      connect,
      disconnect,
      refreshWallets,
      linkConnectedWallet,
      unlinkWallet,
    }),
    [
      balanceSOL,
      connect,
      connectedAddress,
      disconnect,
      displayAddress,
      isConnecting,
      isUpdating,
      linkConnectedWallet,
      primaryWallet,
      providerStatus,
      refreshWallets,
      rpcUrl,
      unlinkWallet,
      wallets,
    ],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const context = React.useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider')
  }

  return context
}
