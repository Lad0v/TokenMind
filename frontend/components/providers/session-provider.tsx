'use client'

import * as React from 'react'

import {
  authApi,
  type AuthMeResponse,
  type LoginRequest,
  type LoginResponse,
  type RegisterRequest,
  type RegisterResponse,
  type WalletLoginVerifyRequest,
} from '@/lib/api'
import { clearAuthTokens, loadAuthTokens, saveAuthTokens, type AuthTokens } from '@/lib/auth-storage'

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface SessionContextValue {
  status: SessionStatus
  user: AuthMeResponse | null
  tokens: AuthTokens | null
  login: (payload: LoginRequest) => Promise<AuthMeResponse>
  loginWithWallet: (payload: WalletLoginVerifyRequest) => Promise<AuthMeResponse>
  register: (payload: RegisterRequest) => Promise<RegisterResponse>
  refreshSession: () => Promise<void>
  logout: () => Promise<void>
}

const SessionContext = React.createContext<SessionContextValue | null>(null)

function readTokens() {
  return loadAuthTokens()
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<SessionStatus>('loading')
  const [user, setUser] = React.useState<AuthMeResponse | null>(null)
  const [tokens, setTokens] = React.useState<AuthTokens | null>(null)

  const authenticateWithTokens = React.useCallback(async (response: LoginResponse) => {
    if (!response.access_token || !response.refresh_token) {
      throw new Error('Authentication response does not contain tokens')
    }

    const nextTokens = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
    }
    saveAuthTokens(nextTokens)
    setTokens(nextTokens)

    const currentUser = await authApi.me()
    setUser(currentUser)
    setStatus('authenticated')
    return currentUser
  }, [])

  const refreshSession = React.useCallback(async () => {
    const storedTokens = readTokens()
    if (!storedTokens) {
      setTokens(null)
      setUser(null)
      setStatus('unauthenticated')
      return
    }

    try {
      const currentUser = await authApi.me()
      setTokens(storedTokens)
      setUser(currentUser)
      setStatus('authenticated')
    } catch {
      clearAuthTokens()
      setTokens(null)
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  React.useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  const login = React.useCallback(async (payload: LoginRequest) => {
    const response = await authApi.login(payload)
    return authenticateWithTokens(response)
  }, [authenticateWithTokens])

  const loginWithWallet = React.useCallback(async (payload: WalletLoginVerifyRequest) => {
    const response = await authApi.verifyWalletLogin(payload)
    return authenticateWithTokens(response)
  }, [authenticateWithTokens])

  const register = React.useCallback((payload: RegisterRequest) => {
    return authApi.register(payload)
  }, [])

  const logout = React.useCallback(async () => {
    const storedTokens = readTokens()

    try {
      if (storedTokens?.refreshToken) {
        await authApi.logout(storedTokens.refreshToken)
      }
    } catch {
      // Logout should still clear local state if the backend token is already invalid.
    } finally {
      clearAuthTokens()
      setTokens(null)
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  const value = React.useMemo<SessionContextValue>(
    () => ({
      status,
      user,
      tokens,
      login,
      loginWithWallet,
      register,
      refreshSession,
      logout,
    }),
    [login, loginWithWallet, logout, refreshSession, register, status, tokens, user],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = React.useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within SessionProvider')
  }

  return context
}
