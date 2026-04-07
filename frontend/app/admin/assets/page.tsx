"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, Coins, Layers3, Loader2, Package, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { claimsApi, marketplaceApi, type IpClaim, type MarketplaceListing } from "@/lib/api"
import { formatStableDate } from "@/lib/date-format"
import { extractAnchorTokenizationConfig } from "@/lib/solana/marketplace-anchor"

function formatSol(value: number) {
  return `${value.toFixed(value >= 100 ? 2 : 4)} SOL`
}

export default function AssetsPage() {
  const [claims, setClaims] = useState<IpClaim[]>([])
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [claimsResponse, listingsResponse] = await Promise.all([
          claimsApi.list(),
          marketplaceApi.listListings(),
        ])

        if (cancelled) {
          return
        }

        setClaims(claimsResponse.items)
        setListings(listingsResponse.items)
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Failed to load assets workspace.")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [])

  const approvedClaims = useMemo(
    () => claims.filter((claim) => claim.status === "approved"),
    [claims],
  )
  const claimIdsWithListings = useMemo(
    () => new Set(listings.map((listing) => listing.claim_id).filter(Boolean)),
    [listings],
  )
  const readyForTokenization = useMemo(
    () => approvedClaims.filter((claim) => !claimIdsWithListings.has(claim.id)),
    [approvedClaims, claimIdsWithListings],
  )
  const anchorListings = useMemo(
    () => listings.filter((listing) => extractAnchorTokenizationConfig(listing)),
    [listings],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assets Management</h1>
          <p className="text-muted-foreground">
            Live admin view for approved IP claims, created marketplace listings and on-chain Anchor assets.
          </p>
        </div>
        <Button asChild>
          <Link href="/issuer/assets/new">
            Создать asset
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Marketplace Listings" value={String(listings.length)} icon={Package} />
        <MetricCard title="On-chain Anchor" value={String(anchorListings.length)} icon={Coins} />
        <MetricCard title="Active Listings" value={String(listings.filter((item) => item.status === "active").length)} icon={Layers3} />
        <MetricCard title="Ready Claims" value={String(readyForTokenization.length)} icon={ShieldCheck} />
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Live Listings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : listings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Пока нет ни одного реального marketplace listing. Создай asset через issuer workspace.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Issuer</TableHead>
                  <TableHead>Supply</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listings.map((listing) => {
                  const anchorConfig = extractAnchorTokenizationConfig(listing)
                  return (
                    <TableRow key={listing.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{listing.title}</div>
                        <div className="text-xs text-muted-foreground">{listing.patent_number}</div>
                      </TableCell>
                      <TableCell>
                        {anchorConfig ? (
                          <Badge className="border-primary/30 bg-primary/10 text-primary">Anchor</Badge>
                        ) : (
                          <Badge variant="secondary">Backend only</Badge>
                        )}
                      </TableCell>
                      <TableCell>{listing.issuer_name}</TableCell>
                      <TableCell>{listing.available_tokens} / {listing.total_tokens}</TableCell>
                      <TableCell>{formatSol(listing.price_per_token_sol)}</TableCell>
                      <TableCell>{formatSol(listing.volume_sol)}</TableCell>
                      <TableCell>{formatStableDate(listing.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/marketplace/${listing.id}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Approved Claims Ready For Tokenization</CardTitle>
        </CardHeader>
        <CardContent>
          {readyForTokenization.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Все approved claims уже связаны с marketplace listings или еще не прошли review.
            </div>
          ) : (
            <div className="space-y-3">
              {readyForTokenization.map((claim) => (
                <div
                  key={claim.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card/40 px-4 py-4"
                >
                  <div>
                    <div className="font-medium text-foreground">{claim.patent_title || claim.patent_number}</div>
                    <div className="text-sm text-muted-foreground">
                      {claim.patent_number} • {claim.claimed_owner_name}
                    </div>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/issuer/assets/new?claimId=${claim.id}`}>Tokenize</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="border-border">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{title}</div>
            <div className="text-2xl font-bold text-foreground">{value}</div>
          </div>
          <Icon className="h-8 w-8 text-primary/50" />
        </div>
      </CardContent>
    </Card>
  )
}
