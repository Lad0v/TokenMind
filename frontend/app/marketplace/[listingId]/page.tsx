"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  Copy,
  ExternalLink,
  Loader2,
  Shield,
  ShieldCheck,
  Wallet,
} from "lucide-react"

import { Header } from "@/components/user/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSession } from "@/components/providers/session-provider"
import { useWallet } from "@/components/providers/wallet-provider"
import { ApiError, marketplaceApi, type MarketplaceListing, userApi } from "@/lib/api"
import { formatWalletAddress, getPhantomProvider } from "@/lib/phantom"
import { sendMarketplaceSolanaTransfer } from "@/lib/solana-marketplace"

function formatSol(value: number) {
  return `${value.toFixed(value >= 100 ? 2 : 4)} SOL`
}

function formatDate(value?: string | null) {
  if (!value) {
    return "—"
  }

  return new Date(value).toLocaleDateString("ru-RU")
}

export default function ListingDetailPage() {
  const params = useParams<{ listingId: string }>()
  const router = useRouter()
  const { status, user } = useSession()
  const {
    providerStatus,
    connectedAddress,
    primaryWallet,
    connect,
    isConnecting,
  } = useWallet()

  const [listing, setListing] = useState<MarketplaceListing | null>(null)
  const [verificationStatus, setVerificationStatus] = useState<string>("not_started")
  const [quantity, setQuantity] = useState("1")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const listingId = Array.isArray(params?.listingId) ? params.listingId[0] : params?.listingId
  const parsedQuantity = Math.max(1, Number.parseInt(quantity || "1", 10) || 1)

  useEffect(() => {
    if (!listingId) {
      return
    }

    let cancelled = false
    setIsLoading(true)

    void marketplaceApi
      .getListing(listingId)
      .then((payload) => {
        if (!cancelled) {
          setListing(payload)
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Не удалось загрузить листинг.")
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
  }, [listingId])

  useEffect(() => {
    if (status !== "authenticated") {
      setVerificationStatus("not_started")
      return
    }

    let cancelled = false
    void userApi
      .getVerificationStatus()
      .then((payload) => {
        if (!cancelled) {
          setVerificationStatus(payload.status)
        }
      })
      .catch((caughtError) => {
        if (cancelled) {
          return
        }
        if (caughtError instanceof ApiError && caughtError.status === 404) {
          setVerificationStatus("not_started")
          return
        }
        setVerificationStatus("unavailable")
      })

    return () => {
      cancelled = true
    }
  }, [status])

  const quotedTotal = useMemo(() => {
    if (!listing) {
      return 0
    }

    return listing.price_per_token_sol * parsedQuantity
  }, [listing, parsedQuantity])

  const soldRatio = listing && listing.total_tokens > 0
    ? ((listing.total_tokens - listing.available_tokens) / listing.total_tokens) * 100
    : 0

  const isBuyerRole = user?.role === "investor" || user?.role === "admin"
  const needsVerification = Boolean(status === "authenticated" && user?.role === "investor" && verificationStatus !== "approved")
  const hasLinkedWallet = Boolean(primaryWallet)
  const connectedWalletMatchesLinked = Boolean(
    connectedAddress && primaryWallet && connectedAddress === primaryWallet.wallet_address,
  )
  const canPurchase = Boolean(
    listing &&
      status === "authenticated" &&
      isBuyerRole &&
      !needsVerification &&
      hasLinkedWallet &&
      connectedWalletMatchesLinked &&
      listing.status === "active" &&
      parsedQuantity <= listing.available_tokens,
  )

  const handleConnectWallet = async () => {
    setError(null)
    try {
      await connect()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось подключить Phantom.")
    }
  }

  const handleCopyMint = async () => {
    if (!listing?.mint_address) {
      return
    }

    try {
      await navigator.clipboard.writeText(listing.mint_address)
      setMessage("Mint address скопирован.")
    } catch {
      setError("Не удалось скопировать адрес.")
    }
  }

  const handlePurchase = async () => {
    if (!listing || !connectedAddress) {
      return
    }

    setError(null)
    setMessage(null)
    setIsSubmitting(true)

    try {
      const provider = getPhantomProvider()
      if (!provider) {
        throw new Error("Phantom не найден в этом браузере.")
      }

      const intent = await marketplaceApi.createPurchase({
        listing_id: listing.id,
        quantity: parsedQuantity,
      })

      const signature = await sendMarketplaceSolanaTransfer({
        amountLamports: intent.transaction.amount_lamports,
        walletAddress: connectedAddress,
        treasuryWalletAddress: intent.transaction.treasury_wallet_address,
        rpcUrl: intent.transaction.rpc_url,
        provider,
      })

      await marketplaceApi.confirmPurchase(intent.purchase.id, { tx_signature: signature })
      setMessage("Покупка подтверждена. Сделка появилась в истории маркетплейса.")

      const refreshed = await marketplaceApi.getListing(listing.id)
      setListing(refreshed)
      router.replace("/marketplace?tab=history")
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message)
      } else if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError("Покупка не завершена.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 lg:px-8 py-8 mt-20">
        <Link
          href="/marketplace"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к маркетплейсу
        </Link>

        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !listing ? (
          <div className="rounded-xl border border-border px-4 py-10 text-center text-sm text-muted-foreground">
            Листинг не найден.
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-xl border border-border bg-card/50 p-6">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                      {listing.status === "active" ? "Активен" : listing.status}
                    </Badge>
                    <Badge variant="secondary">{listing.network}</Badge>
                  </div>

                  {listing.mint_address && (
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Solscan
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">{listing.patent_number}</div>
                  <h1 className="text-2xl font-bold text-foreground lg:text-3xl">{listing.title}</h1>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span>{listing.issuer_name}</span>
                    <span>{listing.category ?? "IP asset"}</span>
                    <span>{formatDate(listing.created_at)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card/50 p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">Описание</h2>
                <p className="leading-relaxed text-muted-foreground">
                  {listing.description ?? "Описание будет доступно после публикации issuer-side metadata."}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card/50 p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">Технические данные</h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <MetricBlock label="Token symbol" value={listing.token_symbol} />
                  <MetricBlock label="Юрисдикция" value={listing.jurisdiction ?? "—"} />
                  <MetricBlock label="Всего токенов" value={String(listing.total_tokens)} />
                  <MetricBlock label="Доступно" value={String(listing.available_tokens)} />
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <MetricBlock label="Treasury wallet" value={listing.treasury_wallet_address} mono />

                  <div className="rounded-lg bg-secondary/30 p-4">
                    <div className="mb-1 text-xs text-muted-foreground">Mint address</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate text-sm text-foreground">{listing.mint_address ?? "Not minted yet"}</code>
                      {listing.mint_address && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => void handleCopyMint()}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {(error || message) && (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    error
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-primary/30 bg-primary/10 text-primary"
                  }`}
                >
                  {error ?? message}
                </div>
              )}

              <div className="sticky top-24 rounded-xl border border-primary/30 bg-card/50 p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Цена за токен</div>
                    <div className="text-3xl font-bold text-primary">{formatSol(listing.price_per_token_sol)}</div>
                  </div>
                  <div className="rounded-full bg-primary/10 p-3">
                    <Wallet className="h-6 w-6 text-primary" />
                  </div>
                </div>

                <div className="mb-6 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Продано</span>
                    <span className="font-medium text-foreground">{(listing.total_tokens - listing.available_tokens)} / {listing.total_tokens}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, soldRatio)}%` }} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity" className="text-xs uppercase tracking-wider text-muted-foreground">
                      Количество токенов
                    </Label>
                    <Input
                      id="quantity"
                      type="number"
                      min={1}
                      max={Math.max(1, listing.available_tokens)}
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      className="h-12 border-border bg-card"
                    />
                  </div>

                  <div className="rounded-lg bg-secondary/30 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Quoted total</span>
                      <span className="text-lg font-semibold text-foreground">{formatSol(quotedTotal)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Итог на блокчейне будет отличаться на несколько lamports для уникальной сверки платежа.
                    </div>
                  </div>

                  {status !== "authenticated" && (
                    <GateNotice
                      icon={Wallet}
                      title="Требуется авторизация"
                      description="Для покупки токенов войдите в аккаунт investor и завершите KYS."
                      primaryHref="/auth/login"
                      primaryLabel="Войти"
                      secondaryHref="/auth/register"
                      secondaryLabel="Регистрация"
                    />
                  )}

                  {status === "authenticated" && !isBuyerRole && (
                    <GateNotice
                      icon={Shield}
                      title="Неверная роль"
                      description="Покупка доступна investor-пользователю. Для admin оставлен только технический bypass."
                    />
                  )}

                  {status === "authenticated" && isBuyerRole && needsVerification && (
                    <GateNotice
                      icon={ShieldCheck}
                      title="KYS не завершен"
                      description={`Текущий статус: ${verificationStatus.replaceAll("_", " ")}. До одобрения покупка заблокирована.`}
                      primaryHref="/marketplace/kyc"
                      primaryLabel="Пройти KYS"
                    />
                  )}

                  {status === "authenticated" && isBuyerRole && !hasLinkedWallet && (
                    <GateNotice
                      icon={Wallet}
                      title="Нет привязанного кошелька"
                      description="Привяжите основной Phantom wallet в профиле перед покупкой."
                      primaryHref="/profile"
                      primaryLabel="Открыть профиль"
                    />
                  )}

                  {status === "authenticated" && isBuyerRole && hasLinkedWallet && !connectedWalletMatchesLinked && (
                    <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
                      <div className="mb-2 text-sm font-medium text-foreground">Подключите тот же кошелек, что привязан к аккаунту</div>
                      <div className="mb-3 text-xs text-muted-foreground">
                        Linked wallet: {formatWalletAddress(primaryWallet?.wallet_address)}. Connected wallet: {formatWalletAddress(connectedAddress)}.
                      </div>
                      <Button
                        type="button"
                        onClick={() => void handleConnectWallet()}
                        disabled={providerStatus !== "ready" || isConnecting}
                        className="w-full"
                      >
                        {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Подключить Phantom"}
                      </Button>
                    </div>
                  )}

                  {status === "authenticated" && isBuyerRole && hasLinkedWallet && connectedWalletMatchesLinked && (
                    <Button
                      type="button"
                      disabled={!canPurchase || isSubmitting}
                      onClick={() => void handlePurchase()}
                      className="h-12 w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Купить через Phantom"}
                    </Button>
                  )}
                </div>

                <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                    <div>
                      <div className="mb-1 text-sm font-medium text-foreground">Предупреждение о рисках</div>
                      <div className="text-xs text-muted-foreground">
                        Solana settlement в этом MVP идет на devnet. Перед production нужно заменить treasury wallet, включить мониторинг и формализовать on-chain issuance.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function MetricBlock({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-secondary/30 p-4">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm text-foreground ${mono ? "break-all font-mono" : ""}`}>{value}</div>
    </div>
  )
}

function GateNotice({
  icon: Icon,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  primaryHref?: string
  primaryLabel?: string
  secondaryHref?: string
  secondaryLabel?: string
}) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
        <div className="flex-1">
          <div className="mb-1 text-sm font-medium text-foreground">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
          {(primaryHref || secondaryHref) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {primaryHref && primaryLabel && (
                <Button asChild size="sm">
                  <Link href={primaryHref}>{primaryLabel}</Link>
                </Button>
              )}
              {secondaryHref && secondaryLabel && (
                <Button asChild variant="outline" size="sm">
                  <Link href={secondaryHref}>{secondaryLabel}</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
