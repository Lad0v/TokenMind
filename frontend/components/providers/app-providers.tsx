'use client'

import type { ReactNode } from 'react'

import { SessionProvider } from '@/components/providers/session-provider'
import { WalletProvider } from '@/components/providers/wallet-provider'
import { Toaster } from '@/components/ui/toaster'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <WalletProvider>
        {children}
        <Toaster />
      </WalletProvider>
    </SessionProvider>
  )
}
