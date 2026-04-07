'use client'

import * as React from 'react'

import { useSession } from '@/components/providers/session-provider'
import { userApi, type UserWallet } from '@/lib/api'
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

  const refreshWallets = React.useCallback(async () => {
    if (status !== 'authenticated') {
      setWallets([])
      return
    }

    const nextWallets = await userApi.listWallets()
    setWallets(nextWallets)
  }, [status])

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
    void provider.connect({ onlyIfTrusted: true }).then((response) => {
      syncProviderAddress(response.publicKey)
    }).catch(() => {
      // Trusted reconnect is best-effort only.
    })

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
      const wallet = await userApi.linkWallet({
        wallet_address: connectedAddress,
        network: 'solana-devnet',
        is_primary: true,
      })
      await refreshWallets()
      return wallet
    } finally {
      setIsUpdating(false)
    }
  }, [connectedAddress, refreshWallets, status])

  const unlinkWallet = React.useCallback(async (walletId: string) => {
    if (status !== 'authenticated') {
      throw new Error('Sign in before unlinking a wallet.')
    }

    setIsUpdating(true)
    try {
      await userApi.unlinkWallet(walletId)
      await refreshWallets()
    } finally {
      setIsUpdating(false)
    }
  }, [refreshWallets, status])

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
