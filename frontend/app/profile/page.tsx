'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ExternalLink, Link2, Loader2, ShieldCheck, Unplug, User2, Wallet } from 'lucide-react'

import { Header } from '@/components/user/header'
import { useSession } from '@/components/providers/session-provider'
import { useWallet } from '@/components/providers/wallet-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError, getDefaultRouteForRole, type ProfileResponse } from '@/lib/api'
import { userApi } from '@/lib/api'
import { formatWalletAddress } from '@/lib/phantom'

export default function ProfilePage() {
  const { status, user } = useSession()
  const {
    providerStatus,
    connectedAddress,
    displayAddress,
    balanceSOL,
    wallets,
    primaryWallet,
    isConnecting,
    isUpdating,
    connect,
    disconnect,
    linkConnectedWallet,
    unlinkWallet,
  } = useWallet()

  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [verificationStatus, setVerificationStatus] = useState<string>('not_started')
  const [isLoading, setIsLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'authenticated') {
      setProfile(null)
      setVerificationStatus('not_started')
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    void Promise.allSettled([userApi.getProfile(), userApi.getVerificationStatus()])
      .then(([profileResult, verificationResult]) => {
        if (cancelled) {
          return
        }

        if (profileResult.status === 'fulfilled') {
          setProfile(profileResult.value)
        }

        if (verificationResult.status === 'fulfilled') {
          setVerificationStatus(verificationResult.value.status)
          return
        }

        const reason = verificationResult.reason
        if (reason instanceof ApiError && reason.status === 404) {
          setVerificationStatus('not_started')
          return
        }

        setVerificationStatus('unavailable')
      })
      .catch(() => {
        if (!cancelled) {
          setError('Не удалось загрузить профиль.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [status])

  const handleConnectWallet = async () => {
    setActionMessage(null)
    setError(null)

    try {
      await connect()
      setActionMessage('Phantom подключен.')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось подключить Phantom.')
    }
  }

  const handleLinkWallet = async () => {
    setActionMessage(null)
    setError(null)

    try {
      await linkConnectedWallet()
      setActionMessage('Кошелек привязан к аккаунту.')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось привязать кошелек.')
    }
  }

  const handleUnlinkWallet = async (walletId: string) => {
    setActionMessage(null)
    setError(null)

    try {
      await unlinkWallet(walletId)
      setActionMessage('Кошелек отвязан.')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось отвязать кошелек.')
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto mt-20 flex min-h-[50vh] max-w-5xl items-center justify-center px-4 py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (status !== 'authenticated' || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto mt-20 max-w-3xl px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Профиль недоступен</CardTitle>
            <CardDescription>Сначала войдите в аккаунт, чтобы управлять профилем и кошельками.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button asChild>
              <Link href="/auth/login">Войти</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/auth/register">Регистрация</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      </div>
    )
  }

  const walletNeedsLink = Boolean(connectedAddress && connectedAddress !== primaryWallet?.wallet_address)

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto mt-20 max-w-6xl px-4 py-10 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Account Center</p>
          <h1 className="text-3xl font-semibold text-foreground">Профиль и Solana Wallet</h1>
          <p className="text-sm text-muted-foreground">
            Базовый рабочий MVP-поток: аккаунт, верификация, Phantom и привязка кошелька к backend.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href={getDefaultRouteForRole(user.role)}>Вернуться в рабочую зону</Link>
        </Button>
      </div>

      {(error || actionMessage) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-primary/30 bg-primary/10 text-primary'
          }`}
        >
          {error ?? actionMessage}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User2 className="h-5 w-5 text-primary" />
              Аккаунт
            </CardTitle>
            <CardDescription>Текущие backend-данные по пользователю и профилю.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ProfileRow label="Email" value={user.email} mono />
            <ProfileRow label="Роль" value={user.role} />
            <ProfileRow label="Статус" value={user.status} />
            <ProfileRow label="Имя" value={user.name ?? profile?.legal_name ?? 'Not set'} />
            <ProfileRow label="Страна" value={profile?.country ?? 'Not set'} />
            <ProfileRow label="Загрузка" value={isLoading ? 'Refreshing...' : 'Ready'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Verification
            </CardTitle>
            <CardDescription>KYS/KYC состояние для marketplace и submitter flows.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Текущий статус</span>
              <StatusBadge status={verificationStatus} />
            </div>

            <div className="rounded-xl border border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
              Одобренный KYS/KYC используется как общий verification gate для marketplace и связанных пользовательских сценариев.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Phantom / Solana
          </CardTitle>
          <CardDescription>
            Подключение Phantom, чтение devnet-баланса и синхронизация кошелька с backend `wallet_links`.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <WalletMetric label="Provider" value={providerStatus === 'ready' ? 'Phantom detected' : 'Phantom not found'} />
            <WalletMetric label="Connected wallet" value={formatWalletAddress(connectedAddress)} mono />
            <WalletMetric label="Primary linked wallet" value={formatWalletAddress(primaryWallet?.wallet_address)} mono />
            <WalletMetric
              label="Balance"
              value={balanceSOL != null ? `${balanceSOL.toFixed(4)} SOL` : 'Unavailable'}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={handleConnectWallet} disabled={isConnecting || providerStatus !== 'ready'}>
              {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4 mr-2" />}
              {connectedAddress ? 'Переподключить Phantom' : 'Подключить Phantom'}
            </Button>

            {connectedAddress && (
              <Button type="button" variant="outline" onClick={() => void disconnect()}>
                <Unplug className="h-4 w-4 mr-2" />
                Отключить
              </Button>
            )}

            {walletNeedsLink && (
              <Button type="button" variant="outline" onClick={handleLinkWallet} disabled={isUpdating}>
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                Привязать к аккаунту
              </Button>
            )}

            {providerStatus !== 'ready' && (
              <Button type="button" variant="outline" asChild>
                <a href="https://phantom.app/" target="_blank" rel="noreferrer">
                  Установить Phantom
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-border/70 bg-background/40 p-4 text-sm text-muted-foreground space-y-1">
            <div>Cluster: Solana Devnet</div>
            <div>Displayed wallet: {displayAddress ?? 'Not available'}</div>
            <div>Backend-linked wallets: {wallets.length}</div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">Linked wallets</h2>
            {wallets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                Кошелек пока не привязан. Подключите Phantom и нажмите «Привязать к аккаунту».
              </div>
            ) : (
              <div className="grid gap-3">
                {wallets.map((wallet) => (
                  <div
                    key={wallet.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/30 px-4 py-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{formatWalletAddress(wallet.wallet_address)}</span>
                        {wallet.is_primary && <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">Primary</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground break-all">{wallet.wallet_address}</div>
                      <div className="text-xs text-muted-foreground">{wallet.network}</div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleUnlinkWallet(wallet.id)}
                      disabled={isUpdating}
                    >
                      Отвязать
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </main>
    </div>
  )
}

function WalletMetric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/40 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-2 text-sm text-foreground ${mono ? 'font-mono break-all' : ''}`}>{value}</div>
    </div>
  )
}

function ProfileRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right text-foreground ${mono ? 'font-mono break-all' : ''}`}>{value}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase()

  if (normalizedStatus === 'approved') {
    return <Badge className="bg-primary/20 text-primary border-primary/30">Approved</Badge>
  }
  if (normalizedStatus === 'pending') {
    return <Badge variant="outline" className="border-yellow-500/40 text-yellow-500">Pending</Badge>
  }
  if (normalizedStatus === 'rejected') {
    return <Badge variant="destructive">Rejected</Badge>
  }
  if (normalizedStatus === 'unavailable') {
    return <Badge variant="secondary">Unavailable</Badge>
  }

  return <Badge variant="outline" className="border-border text-muted-foreground">{status.replaceAll('_', ' ')}</Badge>
}
