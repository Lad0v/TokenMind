"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUpDown,
  ChartColumnBig,
  Coins,
  Loader2,
  Search,
  ShieldCheck,
  ShoppingBag,
  Wallet,
} from "lucide-react"

import { Header } from "@/components/user/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSession } from "@/components/providers/session-provider"
import { useWallet } from "@/components/providers/wallet-provider"
import {
  ApiError,
  marketplaceApi,
  type MarketplaceHolding,
  type MarketplaceListing,
  type MarketplacePurchase,
  type MarketplaceStats,
  userApi,
} from "@/lib/api"

type MarketplaceTab = "marketplace" | "history" | "portfolio"

const tabLabels: Record<MarketplaceTab, string> = {
  marketplace: "Торговая площадка",
  history: "История",
  portfolio: "Портфель",
}

function normalizeTab(value: string | null): MarketplaceTab {
  if (value === "history" || value === "portfolio") {
    return value
  }
  return "marketplace"
}

function formatSol(value: number) {
  return `${value.toFixed(value >= 100 ? 2 : 4)} SOL`
}

function formatDate(value?: string | null) {
  if (!value) {
    return "—"
  }

  return new Date(value).toLocaleString("ru-RU")
}

function purchaseStatusLabel(status: string) {
  switch (status) {
    case "pending_payment":
      return "Ожидает оплату"
    case "confirmed":
      return "Подтверждено"
    case "expired":
      return "Истекло"
    case "failed":
      return "Ошибка"
    case "cancelled":
      return "Отменено"
    default:
      return status.replaceAll("_", " ")
  }
}

export default function MarketplacePage() {
  const router = useRouter()
  const { status, user } = useSession()
  const { primaryWallet } = useWallet()

  const [activeTab, setActiveTab] = useState<MarketplaceTab>("marketplace")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("Все категории")
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [marketStats, setMarketStats] = useState<MarketplaceStats | null>(null)
  const [history, setHistory] = useState<MarketplacePurchase[]>([])
  const [holdings, setHoldings] = useState<MarketplaceHolding[]>([])
  const [portfolioSummary, setPortfolioSummary] = useState({
    total_positions: 0,
    total_tokens: 0,
    invested_sol: 0,
    current_value_sol: 0,
  })
  const [verificationStatus, setVerificationStatus] = useState<string>("not_started")
  const [isLoadingListings, setIsLoadingListings] = useState(true)
  const [isLoadingPrivate, setIsLoadingPrivate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const syncTabFromUrl = () => {
      const params = new URLSearchParams(window.location.search)
      setActiveTab(normalizeTab(params.get("tab")))
    }

    syncTabFromUrl()
    window.addEventListener("popstate", syncTabFromUrl)
    return () => {
      window.removeEventListener("popstate", syncTabFromUrl)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsLoadingListings(true)

    void marketplaceApi
      .listListings()
      .then((payload) => {
        if (cancelled) {
          return
        }
        setListings(payload.items)
        setMarketStats(payload.stats)
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Не удалось загрузить маркетплейс.")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingListings(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (status !== "authenticated") {
      setHistory([])
      setHoldings([])
      setPortfolioSummary({
        total_positions: 0,
        total_tokens: 0,
        invested_sol: 0,
        current_value_sol: 0,
      })
      setVerificationStatus("not_started")
      return
    }

    let cancelled = false
    setIsLoadingPrivate(true)

    void Promise.allSettled([
      marketplaceApi.getHistory(),
      marketplaceApi.getHoldings(),
      userApi.getVerificationStatus(),
    ])
      .then(([historyResult, holdingsResult, verificationResult]) => {
        if (cancelled) {
          return
        }

        if (historyResult.status === "fulfilled") {
          setHistory(historyResult.value.items)
        }
        if (holdingsResult.status === "fulfilled") {
          setHoldings(holdingsResult.value.items)
          setPortfolioSummary(holdingsResult.value.summary)
        }
        if (verificationResult.status === "fulfilled") {
          setVerificationStatus(verificationResult.value.status)
        } else if (verificationResult.reason instanceof ApiError && verificationResult.reason.status === 404) {
          setVerificationStatus("not_started")
        } else {
          setVerificationStatus("unavailable")
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Не удалось загрузить личные данные маркетплейса.")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPrivate(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [status])

  const categories = useMemo(() => {
    const values = new Set<string>()
    for (const listing of listings) {
      if (listing.category) {
        values.add(listing.category)
      }
    }
    return ["Все категории", ...Array.from(values).sort((left, right) => left.localeCompare(right))]
  }, [listings])

  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      const matchesSearch =
        listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.patent_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.token_symbol.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory =
        selectedCategory === "Все категории" || listing.category === selectedCategory

      return matchesSearch && matchesCategory
    })
  }, [listings, searchQuery, selectedCategory])

  const isInvestor = user?.role === "investor"
  const needsKys = status === "authenticated" && isInvestor && verificationStatus !== "approved"
  const needsWallet = status === "authenticated" && isInvestor && !primaryWallet

  const handleTabChange = (nextTab: MarketplaceTab) => {
    setActiveTab(nextTab)
    router.replace(`/marketplace?tab=${nextTab}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 lg:px-8 py-8 mt-20 space-y-8">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              Solana Marketplace MVP
            </Badge>
            <h1 className="text-3xl font-bold text-foreground">Маркетплейс токенизированных IP-активов</h1>
            <p className="max-w-3xl text-muted-foreground">
              Один рабочий контур для листингов, истории расчетов и портфеля инвестора. Покупка проходит через
              Phantom и подтверждается backend по Solana RPC.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["marketplace", "history", "portfolio"] as MarketplaceTab[]).map((tab) => (
              <Button
                key={tab}
                type="button"
                variant={activeTab === tab ? "default" : "outline"}
                onClick={() => handleTabChange(tab)}
                className={activeTab === tab ? "bg-primary text-primary-foreground" : ""}
              >
                {tabLabels[tab]}
              </Button>
            ))}
          </div>
        </section>

        {(error || needsKys || needsWallet) && (
          <div className="grid gap-3 lg:grid-cols-3">
            {error && (
              <Card className="border-destructive/30 bg-destructive/10 lg:col-span-3">
                <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
              </Card>
            )}

            {needsKys && (
              <Card className="border-yellow-500/30 bg-yellow-500/10 lg:col-span-2">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">KYS обязателен перед покупкой токенов</div>
                    <div className="text-sm text-muted-foreground">
                      Текущий статус: {verificationStatus.replaceAll("_", " ")}. Загрузите документы и дождитесь одобрения.
                    </div>
                  </div>
                  <Button asChild>
                    <Link href="/marketplace/kyc">Пройти KYS</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {needsWallet && (
              <Card className="border-primary/30 bg-primary/10">
                <CardContent className="flex h-full flex-col justify-between gap-4 pt-6">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">Нужен привязанный Phantom wallet</div>
                    <div className="text-sm text-muted-foreground">
                      Привяжите основной Solana-кошелек в профиле, чтобы backend мог проверить оплату.
                    </div>
                  </div>
                  <Button asChild variant="outline">
                    <Link href="/profile">Открыть профиль</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            icon={ShoppingBag}
            label="Активных листингов"
            value={isLoadingListings ? "..." : String(marketStats?.active_listings ?? 0)}
          />
          <MetricCard
            icon={Coins}
            label="Доступно токенов"
            value={isLoadingListings ? "..." : String(marketStats?.total_available_tokens ?? 0)}
          />
          <MetricCard
            icon={Wallet}
            label="Объем confirmed"
            value={isLoadingListings ? "..." : formatSol(marketStats?.total_volume_sol ?? 0)}
          />
          <MetricCard
            icon={ChartColumnBig}
            label="Floor price"
            value={isLoadingListings ? "..." : formatSol(marketStats?.floor_price_sol ?? 0)}
          />
        </section>

        {activeTab === "marketplace" && (
          <section className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Поиск по названию, тикеру или номеру патента..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-12 border-border bg-card pl-10"
                />
              </div>

              <div className="flex gap-3">
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="h-12 rounded-md border border-border bg-card px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <Button variant="outline" className="h-12 border-border">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Live order
                </Button>
              </div>
            </div>

            {isLoadingListings ? (
              <div className="flex min-h-[260px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredListings.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                  По текущему фильтру листинги не найдены.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredListings.map((listing) => {
                  const fillRatio = listing.total_tokens > 0 ? listing.available_tokens / listing.total_tokens : 0
                  return (
                    <Link
                      key={listing.id}
                      href={`/marketplace/${listing.id}`}
                      className="group rounded-xl border border-border bg-card/50 p-6 transition-all hover:border-primary/50 hover:bg-card"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                          {listing.status === "active" ? "Активен" : listing.status}
                        </Badge>
                        <Badge variant="secondary">{listing.network}</Badge>
                      </div>

                      <div className="mb-4 space-y-2">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">{listing.patent_number}</div>
                        <h2 className="line-clamp-2 text-lg font-semibold text-foreground group-hover:text-primary">
                          {listing.title}
                        </h2>
                        <div className="text-sm text-muted-foreground">
                          {listing.issuer_name} • {listing.token_symbol}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Цена</div>
                          <div className="font-semibold text-primary">{formatSol(listing.price_per_token_sol)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Доступно</div>
                          <div className="font-medium text-foreground">
                            {listing.available_tokens} / {listing.total_tokens}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="h-2 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.max(4, fillRatio * 100)}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === "history" && (
          <Card>
            <CardHeader>
              <CardTitle>История расчетов и покупок</CardTitle>
              <CardDescription>
                Pending, confirmed и истекшие сделки инвестора. Каждая confirmed покупка проверяется backend через Solana RPC.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {status !== "authenticated" ? (
                <AuthRequiredCard />
              ) : isLoadingPrivate ? (
                <div className="flex min-h-[180px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : history.length === 0 ? (
                <EmptyState
                  title="История пока пуста"
                  description="После первой покупки здесь появятся blockchain-подтверждения и статусы расчетов."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Актив</TableHead>
                      <TableHead>Кол-во</TableHead>
                      <TableHead>Сумма</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Tx</TableHead>
                      <TableHead>Дата</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell className="font-mono text-xs">{purchase.reference_code}</TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">{purchase.listing.title}</div>
                          <div className="text-xs text-muted-foreground">{purchase.listing.token_symbol}</div>
                        </TableCell>
                        <TableCell>{purchase.quantity}</TableCell>
                        <TableCell>{formatSol(purchase.total_sol)}</TableCell>
                        <TableCell>
                          <PurchaseStatusBadge status={purchase.status} />
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate font-mono text-xs text-muted-foreground">
                          {purchase.tx_signature ?? "—"}
                        </TableCell>
                        <TableCell>{formatDate(purchase.confirmed_at ?? purchase.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "portfolio" && (
          <section className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={Wallet} label="Позиции" value={String(portfolioSummary.total_positions)} />
              <MetricCard icon={Coins} label="Всего токенов" value={String(portfolioSummary.total_tokens)} />
              <MetricCard icon={ShoppingBag} label="Инвестировано" value={formatSol(portfolioSummary.invested_sol)} />
              <MetricCard icon={ShieldCheck} label="Текущая стоимость" value={formatSol(portfolioSummary.current_value_sol)} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Купленные токены и текущие позиции</CardTitle>
                <CardDescription>
                  Сводка по приобретенным tokenized IP assets, средней цене входа и текущей стоимости позиции.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {status !== "authenticated" ? (
                  <AuthRequiredCard />
                ) : isLoadingPrivate ? (
                  <div className="flex min-h-[180px] items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : holdings.length === 0 ? (
                  <EmptyState
                    title="Портфель пока пуст"
                    description="Когда confirmed покупка пройдет через Solana checkout, позиция появится здесь автоматически."
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Актив</TableHead>
                        <TableHead>Тикер</TableHead>
                        <TableHead>Кол-во</TableHead>
                        <TableHead>Средняя цена</TableHead>
                        <TableHead>Инвестировано</TableHead>
                        <TableHead>Текущая стоимость</TableHead>
                        <TableHead>Статус</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holdings.map((holding) => (
                        <TableRow key={holding.listing_id}>
                          <TableCell>
                            <div className="font-medium text-foreground">{holding.title}</div>
                            <div className="text-xs text-muted-foreground">{holding.patent_number}</div>
                          </TableCell>
                          <TableCell>{holding.token_symbol}</TableCell>
                          <TableCell>{holding.quantity}</TableCell>
                          <TableCell>{formatSol(holding.avg_price_per_token_sol)}</TableCell>
                          <TableCell>{formatSol(holding.invested_sol)}</TableCell>
                          <TableCell>{formatSol(holding.current_value_sol)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                              {holding.status.replaceAll("_", " ")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}

function AuthRequiredCard() {
  return (
    <EmptyState
      title="Нужна авторизация"
      description="Войдите как investor, привяжите Phantom и пройдите KYS, чтобы видеть личную историю и портфель."
      actionHref="/auth/login"
      actionLabel="Войти"
    />
  )
}

function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string
  description: string
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
      <div className="mx-auto max-w-xl space-y-2">
        <div className="text-lg font-semibold text-foreground">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
        {actionHref && actionLabel && (
          <div className="pt-2">
            <Button asChild>
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function PurchaseStatusBadge({ status }: { status: string }) {
  if (status === "confirmed") {
    return <Badge className="border-primary/30 bg-primary/10 text-primary">Подтверждено</Badge>
  }
  if (status === "pending_payment") {
    return <Badge variant="outline" className="border-yellow-500/30 text-yellow-500">{purchaseStatusLabel(status)}</Badge>
  }
  if (status === "expired") {
    return <Badge variant="secondary">{purchaseStatusLabel(status)}</Badge>
  }
  return <Badge variant="destructive">{purchaseStatusLabel(status)}</Badge>
}
