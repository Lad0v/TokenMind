"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Clock, Coins, FileText, Plus, Shield, Store } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/user/header"
import { claimsApi, marketplaceApi, type IpClaim, type MarketplaceListing, ApiError } from "@/lib/api"
import { formatStableDate } from "@/lib/date-format"
import { formatWalletAddress } from "@/lib/phantom"
import { useRoleGuard } from "@/lib/use-role-guard"

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string; icon: typeof CheckCircle2 }
> = {
  draft: { label: "Черновик", color: "text-muted-foreground", bgColor: "bg-muted", icon: FileText },
  submitted: { label: "Отправлено", color: "text-blue-500", bgColor: "bg-blue-500/10", icon: Clock },
  prechecked: { label: "Проверено API", color: "text-cyan-500", bgColor: "bg-cyan-500/10", icon: Shield },
  awaiting_kyc: { label: "Ожидание KYC", color: "text-orange-500", bgColor: "bg-orange-500/10", icon: Clock },
  under_review: { label: "На проверке", color: "text-yellow-500", bgColor: "bg-yellow-500/10", icon: Clock },
  approved: { label: "Одобрено", color: "text-primary", bgColor: "bg-primary/10", icon: CheckCircle2 },
  rejected: { label: "Отклонено", color: "text-destructive", bgColor: "bg-destructive/10", icon: CheckCircle2 },
}

export default function IssuerDashboardPage() {
  const { status, user, isAuthorized } = useRoleGuard(["issuer", "user", "admin"])
  const [claims, setClaims] = useState<IpClaim[]>([])
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [listingNotice, setListingNotice] = useState<{
    id: string
    title: string
    payoutWallet: string
  } | null>(null)

  useEffect(() => {
    if (!isAuthorized || typeof window === "undefined") {
      return
    }

    const rawValue = window.sessionStorage.getItem("tokenmind.lastListingCreated")
    if (!rawValue) {
      return
    }

    try {
      const parsed = JSON.parse(rawValue) as { id?: string; title?: string; payoutWallet?: string }
      if (parsed.id && parsed.title && parsed.payoutWallet) {
        setListingNotice({
          id: parsed.id,
          title: parsed.title,
          payoutWallet: parsed.payoutWallet,
        })
      }
    } catch {
      // Ignore stale session payloads from older UI versions.
    } finally {
      window.sessionStorage.removeItem("tokenmind.lastListingCreated")
    }
  }, [isAuthorized])

  useEffect(() => {
    if (!isAuthorized) {
      return
    }

    let isCancelled = false

    const loadClaims = async () => {
      setIsLoading(true)
      setError(null)

      const [claimsResult, listingsResult] = await Promise.allSettled([
        claimsApi.list(),
        marketplaceApi.listListings(),
      ])

      if (isCancelled) {
        return
      }

      const nextErrors: string[] = []

      if (claimsResult.status === "fulfilled") {
        setClaims(claimsResult.value.items)
      } else if (claimsResult.reason instanceof ApiError) {
        nextErrors.push(claimsResult.reason.message)
      } else if (claimsResult.reason instanceof Error) {
        nextErrors.push(claimsResult.reason.message)
      } else {
        nextErrors.push("Не удалось загрузить список IP claims.")
      }

      if (listingsResult.status === "fulfilled") {
        setListings(listingsResult.value.items)
      } else if (listingsResult.reason instanceof ApiError) {
        nextErrors.push(listingsResult.reason.message)
      } else if (listingsResult.reason instanceof Error) {
        nextErrors.push(listingsResult.reason.message)
      } else {
        nextErrors.push("Не удалось загрузить marketplace listings.")
      }

      setError(nextErrors.length > 0 ? nextErrors.join(" ") : null)
      setIsLoading(false)
    }

    void loadClaims()
    return () => {
      isCancelled = true
    }
  }, [isAuthorized])

  const approvedClaims = useMemo(
    () => claims.filter((claim) => claim.status === "approved"),
    [claims],
  )

  const ownListings = useMemo(() => {
    const ownClaimIds = new Set(claims.map((claim) => claim.id))

    return listings.filter((listing) => {
      if (listing.created_by_user_id && listing.created_by_user_id === user?.id) {
        return true
      }
      return Boolean(listing.claim_id && ownClaimIds.has(listing.claim_id))
    })
  }, [claims, listings, user?.id])

  const readyClaims = useMemo(() => {
    const listedClaimIds = new Set(
      ownListings.map((listing) => listing.claim_id).filter((value): value is string => Boolean(value)),
    )

    return approvedClaims.filter((claim) => !listedClaimIds.has(claim.id))
  }, [approvedClaims, ownListings])

  const stats = useMemo(
    () => [
      { label: "Всего заявок", value: claims.length, icon: FileText },
      { label: "На проверке", value: claims.filter((claim) => claim.status === "under_review").length, icon: Clock },
      { label: "Одобрено", value: claims.filter((claim) => claim.status === "approved").length, icon: CheckCircle2 },
      { label: "На маркетплейсе", value: ownListings.length, icon: Coins },
    ],
    [claims, ownListings.length],
  )

  if (status === "loading" || !isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading issuer workspace...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 lg:px-8 py-8 mt-20">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Кабинет правообладателя</h1>
            <p className="text-muted-foreground">
              Управляйте IP claims, выпускайте токенизированные активы и публикуйте их на маркетплейсе
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="w-fit">
              <Link href="/issuer/assets/new">
                <Store className="mr-2 h-4 w-4" />
                Продать актив
              </Link>
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground w-fit">
              <Link href="/issuer/ip/new">
                <Plus className="h-4 w-4 mr-2" />
                Подать патент
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="p-4 rounded-xl border border-border bg-card/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 mb-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Статус пользователя: {user?.status}</p>
                <p className="text-sm text-muted-foreground">
                  KYC / verification status: {user?.verification_status ?? "not_started"}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
              Live API
            </Badge>
          </div>
        </div>

        {listingNotice && (
          <div className="mb-8 rounded-xl border border-primary/30 bg-primary/10 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">Листинг опубликован</div>
                <div className="text-sm text-muted-foreground">
                  `{listingNotice.title}` уже доступен на маркетплейсе. Все тестовые SOL-платежи будут уходить на
                  seller wallet {formatWalletAddress(listingNotice.payoutWallet)}.
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href={`/marketplace/${listingNotice.id}`}>Открыть listing</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/marketplace">Открыть marketplace</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        <section className="rounded-xl border border-border bg-card/50 overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <h2 className="text-sm font-medium text-foreground">Мои заявки</h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-sm text-muted-foreground">Загрузка заявок...</div>
          ) : error ? (
            <div className="p-8 text-sm text-destructive">{error}</div>
          ) : claims.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground">
              Пока нет ни одной заявки. Начните с формы подачи нового патента.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Патент
                    </th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Правообладатель
                    </th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Статус
                    </th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Создано
                    </th>
                    <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => {
                    const statusView = statusConfig[claim.status] ?? statusConfig.submitted
                    const StatusIcon = statusView.icon

                    return (
                      <tr key={claim.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            <code className="text-sm text-foreground font-mono">{claim.patent_number}</code>
                            <p className="text-sm text-muted-foreground line-clamp-1">{claim.patent_title || "Без названия"}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-foreground">{claim.claimed_owner_name}</span>
                        </td>
                        <td className="p-4">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${statusView.bgColor}`}>
                            <StatusIcon className={`h-3.5 w-3.5 ${statusView.color}`} />
                            <span className={`text-xs font-medium ${statusView.color}`}>{statusView.label}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-muted-foreground">{formatStableDate(claim.created_at)}</span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            {claim.status === "approved" && (
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/issuer/assets/new?claimId=${claim.id}`}>Листинг</Link>
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/issuer/ip/${claim.id}`}>Открыть</Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-xl border border-border bg-card/50 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Как выставить актив на маркетплейс</h2>
              <p className="text-sm text-muted-foreground">
                Рабочий seller flow теперь начинается прямо отсюда. Нужен approved IP claim и привязанный Phantom wallet.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/issuer/assets/new">
                Открыть мастер листинга
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StepCard
              step="1"
              title="Подай IP claim"
              description="Создай заявку с патентом и документами через форму подачи."
              href="/issuer/ip/new"
              label="Новая заявка"
            />
            <StepCard
              step="2"
              title="Дождись approved"
              description="После review claim перейдет в approved и станет доступен для листинга."
            />
            <StepCard
              step="3"
              title="Выставь на маркетплейс"
              description="Открой мастер листинга, задай цену и количество. Покупатели будут отправлять SOL прямо на твой seller wallet."
              href="/issuer/assets/new"
              label="Продать актив"
            />
          </div>
        </section>

        <section className="mt-8 rounded-xl border border-border bg-card/50 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Готово к листингу</h2>
              <p className="text-sm text-muted-foreground">
                Эти approved claims еще не выставлены на маркетплейс. Нажми `Выставить`, чтобы открыть мастер уже с выбранным claim.
              </p>
            </div>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              {readyClaims.length} ready
            </Badge>
          </div>

          {readyClaims.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              Пока нет approved claims без листинга. Сначала одобри IP claim или создай новую заявку.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {readyClaims.map((claim) => (
                <div key={claim.id} className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <code className="text-sm font-mono text-foreground">{claim.patent_number}</code>
                    <Badge className="border-primary/30 bg-primary/10 text-primary">Approved</Badge>
                  </div>
                  <div className="mb-2 text-base font-semibold text-foreground">
                    {claim.patent_title || claim.claimed_owner_name}
                  </div>
                  <div className="mb-4 text-sm text-muted-foreground">
                    {claim.description || "Описание не добавлено. Его можно дополнить при создании asset/listing."}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild>
                      <Link href={`/issuer/assets/new?claimId=${claim.id}`}>Продать актив</Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href={`/issuer/ip/${claim.id}`}>Открыть claim</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-xl border border-border bg-card/50 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Мои marketplace assets</h2>
              <p className="text-sm text-muted-foreground">
                Все listing assets, которые уже связаны с твоими claims или были созданы из этого кабинета.
              </p>
            </div>
            <Badge variant="secondary">{ownListings.length} assets</Badge>
          </div>

          {ownListings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              Пока нет активов на маркетплейсе. Начни с блока `Готово к листингу` выше.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {ownListings.map((listing) => (
                <div key={listing.id} className="rounded-xl border border-border bg-background/60 p-5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-base font-semibold text-foreground">{listing.title}</div>
                    <Badge variant={listing.status === "active" ? "default" : "secondary"}>
                      {listing.status}
                    </Badge>
                  </div>
                  <div className="mb-3 text-sm text-muted-foreground">
                    {listing.patent_number} • {listing.token_symbol} • {listing.available_tokens}/{listing.total_tokens}
                  </div>
                  <div className="mb-4 text-sm text-foreground">
                    Цена: {listing.price_per_token_sol.toFixed(4)} SOL за токен
                  </div>
                  <div className="mb-4 grid gap-2 text-sm text-muted-foreground">
                    <div>Продано: {listing.sold_tokens} токенов</div>
                    <div>Сделок: {listing.purchase_count}</div>
                    <div>Выручка: {listing.volume_sol.toFixed(4)} SOL</div>
                    <div>Payout wallet: {formatWalletAddress(listing.treasury_wallet_address)}</div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild>
                      <Link href={`/marketplace/${listing.id}`}>Открыть listing</Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/marketplace">Открыть marketplace</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function StepCard({
  step,
  title,
  description,
  href,
  label,
}: {
  step: string
  title: string
  description: string
  href?: string
  label?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-5">
      <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {step}
      </div>
      <div className="mb-2 text-base font-semibold text-foreground">{title}</div>
      <div className="text-sm text-muted-foreground">{description}</div>
      {href && label && (
        <Button asChild variant="outline" className="mt-4">
          <Link href={href}>{label}</Link>
        </Button>
      )}
    </div>
  )
}
