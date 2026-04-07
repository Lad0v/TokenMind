'use client'

import type { ReactNode } from 'react'

import { SessionProvider } from '@/components/providers/session-provider'
import { WalletProvider } from '@/components/providers/wallet-provider'
import { Toaster } from '@/components/ui/toaster'
import { AuthProvider } from '@/lib/auth-context'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SessionProvider>
        <WalletProvider>
          {children}
          <Toaster />
        </WalletProvider>
      </SessionProvider>
    </AuthProvider>
  )
}
