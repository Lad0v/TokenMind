"use client"

import { Suspense, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Coins, ExternalLink, Loader2, Wallet } from "lucide-react"

import { Header } from "@/components/user/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, claimsApi, marketplaceApi, type IpClaim } from "@/lib/api"
import { formatWalletAddress } from "@/lib/phantom"
import { useRoleGuard } from "@/lib/use-role-guard"
import { useWallet } from "@/components/providers/wallet-provider"

const CATEGORY_OPTIONS = [
  "Software",
  "Biotech",
  "Energy",
  "Semiconductors",
  "Advanced materials",
  "Hardware",
  "Automotive",
]

export default function CreateMarketplaceAssetPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading issuer asset workspace...
      </div>
    }>
      <CreateMarketplaceAssetPageContent />
    </Suspense>
  )
}

function CreateMarketplaceAssetPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status, isAuthorized } = useRoleGuard(["issuer", "user", "admin"])
  const { primaryWallet, connectedAddress, connect, isConnecting, providerStatus } = useWallet()

  const [claims, setClaims] = useState<IpClaim[]>([])
  const [isLoadingClaims, setIsLoadingClaims] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    claimId: "",
    title: "",
    patentNumber: "",
    issuerName: "",
    description: "",
    category: CATEGORY_OPTIONS[0],
    jurisdiction: "US",
    tokenSymbol: "",
    tokenName: "",
    totalTokens: "1000",
    pricePerTokenSol: "0.25",
    treasuryWalletAddress: "",
  })

  useEffect(() => {
    if (!isAuthorized) {
      return
    }

    let cancelled = false

    const loadClaims = async () => {
      setIsLoadingClaims(true)
      setError(null)

      try {
        const response = await claimsApi.list()
        if (cancelled) {
          return
        }

        const approvedClaims = response.items.filter((item) => item.status === "approved")
        setClaims(approvedClaims)

        const requestedClaimId = searchParams.get("claimId")
        const selectedClaim =
          approvedClaims.find((item) => item.id === requestedClaimId) ?? approvedClaims[0] ?? null

        if (selectedClaim) {
          applyClaimDefaults(selectedClaim)
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Не удалось загрузить одобренные IP claims.")
        }
      } finally {
        if (!cancelled) {
          setIsLoadingClaims(false)
        }
      }
    }

    void loadClaims()
    return () => {
      cancelled = true
    }
  }, [isAuthorized, searchParams])

  const selectedClaim = useMemo(
    () => claims.find((item) => item.id === formData.claimId) ?? null,
    [claims, formData.claimId],
  )

  const primaryWalletAddress = primaryWallet?.wallet_address ?? connectedAddress ?? ""
  const sellerWalletReady = Boolean(primaryWallet?.wallet_address)

  function applyClaimDefaults(claim: IpClaim) {
    setFormData((current) => ({
      ...current,
      claimId: claim.id,
      title: claim.patent_title || claim.patent_number,
      patentNumber: claim.patent_number,
      issuerName: claim.claimed_owner_name || claim.issuer_name || current.issuerName,
      description: claim.description || current.description,
      jurisdiction: claim.jurisdiction || current.jurisdiction,
      tokenSymbol: current.tokenSymbol || claim.patent_number.replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase(),
      tokenName: current.tokenName || (claim.patent_title || claim.patent_number).slice(0, 120),
      treasuryWalletAddress: current.treasuryWalletAddress || primaryWalletAddress,
    }))
  }

  const handleClaimChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const claim = claims.find((item) => item.id === event.target.value)
    if (claim) {
      applyClaimDefaults(claim)
    } else {
      setFormData((current) => ({ ...current, claimId: event.target.value }))
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (!primaryWallet?.wallet_address) {
        throw new Error("Сначала привяжи основной seller wallet в профиле. На него будут приходить платежи покупателей.")
      }

      const listing = await marketplaceApi.createListing({
        claim_id: formData.claimId || undefined,
        title: formData.title,
        patent_number: formData.patentNumber,
        issuer_name: formData.issuerName,
        description: formData.description || undefined,
        category: formData.category || undefined,
        jurisdiction: formData.jurisdiction || undefined,
        token_symbol: formData.tokenSymbol,
        token_name: formData.tokenName || undefined,
        total_tokens: Number.parseInt(formData.totalTokens, 10),
        price_per_token_sol: Number.parseFloat(formData.pricePerTokenSol),
        treasury_wallet_address: primaryWallet.wallet_address,
        network: "solana-devnet",
        external_metadata: {
          source: "issuer_asset_creation",
          claim_id: formData.claimId || null,
          settlement: {
            mode: "sol-transfer",
            payout_wallet: primaryWallet.wallet_address,
          },
        },
      })

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "tokenmind.lastListingCreated",
          JSON.stringify({
            id: listing.id,
            title: listing.title,
            payoutWallet: listing.treasury_wallet_address,
          }),
        )
      }

      router.push("/issuer")
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message)
      } else if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError("Не удалось создать listing.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === "loading" || !isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading issuer asset workspace...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 lg:px-8 mt-20">
        <div className="mx-auto max-w-3xl">
          <Link href="/issuer" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Назад в кабинет
          </Link>

          <div className="mb-8 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Coins className="h-3.5 w-3.5" />
              Working Seller Listing
            </div>
            <h1 className="text-3xl font-bold text-foreground">Выставить актив на маркетплейс</h1>
            <p className="text-sm text-muted-foreground">
              Этот экран создает рабочий marketplace listing. Покупатели платят SOL через Phantom, а средства уходят прямо на seller wallet, привязанный к аккаунту.
            </p>
          </div>

          {error && (
            <div
              className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <div className="mb-6 rounded-xl border border-border bg-card/50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-foreground">Seller payout wallet</div>
                <div className="text-xs text-muted-foreground">
                  Все тестовые SOL-платежи покупателей будут уходить прямо на этот wallet.
                </div>
              </div>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                <Wallet className="mr-1 h-3.5 w-3.5" />
                {formatWalletAddress(primaryWalletAddress)}
              </Badge>
            </div>
          </div>

          {!sellerWalletReady && (
            <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5">
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Нужен привязанный seller wallet</div>
                <div className="text-sm text-muted-foreground">
                  Без primary wallet нельзя принять оплату от покупателей. Привяжи wallet в профиле и затем вернись сюда.
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" onClick={() => void connect()} disabled={isConnecting || providerStatus === "unsupported"}>
                    {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Подключить Phantom"}
                  </Button>
                  <Button type="button" variant="ghost" asChild>
                    <Link href="/profile">Проверить wallet в профиле</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="rounded-xl border border-border bg-card/50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Источник актива</h2>
              <div className="space-y-2">
                <Label htmlFor="claimId">Approved IP Claim</Label>
                <select
                  id="claimId"
                  value={formData.claimId}
                  onChange={handleClaimChange}
                  disabled={isLoadingClaims}
                  className="flex h-12 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  <option value="">Выберите approved claim</option>
                  {claims.map((claim) => (
                    <option key={claim.id} value={claim.id}>
                      {claim.patent_number} • {claim.patent_title || claim.claimed_owner_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {isLoadingClaims
                    ? "Загружаем approved claims..."
                    : claims.length === 0
                      ? "Нет ни одного approved claim. Сначала пройди IP review."
                      : "Для production marketplace listing создается только из approved claim."}
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card/50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Listing metadata</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Title">
                  <Input value={formData.title} onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))} required />
                </Field>
                <Field label="Patent number">
                  <Input value={formData.patentNumber} onChange={(event) => setFormData((current) => ({ ...current, patentNumber: event.target.value.toUpperCase() }))} required />
                </Field>
                <Field label="Issuer / owner name">
                  <Input value={formData.issuerName} onChange={(event) => setFormData((current) => ({ ...current, issuerName: event.target.value }))} required />
                </Field>
                <Field label="Jurisdiction">
                  <Input value={formData.jurisdiction} onChange={(event) => setFormData((current) => ({ ...current, jurisdiction: event.target.value.toUpperCase() }))} />
                </Field>
                <Field label="Category">
                  <select
                    value={formData.category}
                    onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value }))}
                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  >
                    {CATEGORY_OPTIONS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Issuer payout wallet">
                  <Input
                    value={primaryWalletAddress}
                    readOnly
                    placeholder="Привяжи и подключи Phantom wallet"
                  />
                </Field>
                <Field label="Token symbol">
                  <Input value={formData.tokenSymbol} onChange={(event) => setFormData((current) => ({ ...current, tokenSymbol: event.target.value.toUpperCase() }))} required />
                </Field>
                <Field label="Token name">
                  <Input value={formData.tokenName} onChange={(event) => setFormData((current) => ({ ...current, tokenName: event.target.value }))} />
                </Field>
                <Field label="Total tokens">
                  <Input type="number" min="1" value={formData.totalTokens} onChange={(event) => setFormData((current) => ({ ...current, totalTokens: event.target.value }))} required />
                </Field>
                <Field label="Price per token (SOL)">
                  <Input type="number" min="0.0001" step="0.0001" value={formData.pricePerTokenSol} onChange={(event) => setFormData((current) => ({ ...current, pricePerTokenSol: event.target.value }))} required />
                </Field>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                  rows={5}
                  className="w-full rounded-md border border-input bg-background px-3 py-3 text-sm text-foreground"
                  placeholder="Короткое описание IP asset для покупателей маркетплейса"
                />
              </div>
            </section>

            {selectedClaim && (
              <section className="rounded-xl border border-primary/20 bg-primary/5 p-6">
                <h2 className="mb-3 text-lg font-semibold text-foreground">Claim snapshot</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  <SnapshotRow label="Claim status" value={selectedClaim.status} />
                  <SnapshotRow label="Patent number" value={selectedClaim.patent_number} />
                  <SnapshotRow label="Owner" value={selectedClaim.claimed_owner_name} />
                  <SnapshotRow label="Documents" value={String(selectedClaim.documents.length)} />
                </div>
              </section>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                disabled={isSubmitting || isLoadingClaims || claims.length === 0 || !sellerWalletReady}
                className="h-12 px-6"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Выставить на продажу"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/marketplace">
                  Открыть marketplace
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-primary/20 bg-background/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}
