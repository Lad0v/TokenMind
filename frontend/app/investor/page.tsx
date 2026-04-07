'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Coins, Loader2, TrendingUp, Wallet } from 'lucide-react'

import { Header } from '@/components/user/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApiError, marketplaceApi, type MarketplaceHolding } from '@/lib/api'
import { useRoleGuard } from '@/lib/use-role-guard'

function formatSol(value: number) {
  return `${value.toFixed(value >= 100 ? 2 : 4)} SOL`
}

export default function InvestorPage() {
  const { status, isAuthorized } = useRoleGuard(['investor', 'admin'])
  const [holdings, setHoldings] = useState<MarketplaceHolding[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthorized) {
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    void marketplaceApi
      .getHoldings()
      .then((payload) => {
        if (!cancelled) {
          setHoldings(payload.items)
        }
      })
      .catch((caughtError) => {
        if (cancelled) return

        if (caughtError instanceof ApiError) {
          setError(caughtError.message)
        } else if (caughtError instanceof Error) {
          setError(caughtError.message)
        } else {
          setError('Failed to load investments.')
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
  }, [isAuthorized])

  const activeHoldings = useMemo(() => holdings.filter((holding) => holding.quantity > 0), [holdings])

  const totals = useMemo(() => {
    return activeHoldings.reduce(
      (acc, holding) => {
        acc.tokens += holding.quantity
        acc.invested += holding.invested_sol
        acc.current += holding.current_value_sol
        return acc
      },
      { tokens: 0, invested: 0, current: 0 },
    )
  }, [activeHoldings])

  if (status === 'loading' || !isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 lg:px-8 py-8 mt-20 space-y-8">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              Investor
            </Badge>
            <h1 className="text-3xl font-bold text-foreground">Active Investments</h1>
            <p className="text-muted-foreground max-w-2xl">
              Your active token positions and current portfolio value.
            </p>
          </div>
          <Button asChild>
            <Link href="/marketplace">Go to Marketplace</Link>
          </Button>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Positions</p>
                  <p className="text-2xl font-semibold text-foreground">{activeHoldings.length}</p>
                </div>
                <Wallet className="h-5 w-5 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tokens</p>
                  <p className="text-2xl font-semibold text-foreground">{totals.tokens}</p>
                </div>
                <Coins className="h-5 w-5 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Portfolio Value</p>
                  <p className="text-2xl font-semibold text-foreground">{formatSol(totals.current)}</p>
                </div>
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Your Active Tokens</CardTitle>
            <CardDescription>Only positions with quantity greater than zero are shown.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex min-h-[180px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : activeHoldings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground mb-3">No active token positions yet.</p>
                <Button asChild variant="outline">
                  <Link href="/marketplace">Browse Listings</Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Avg Price</TableHead>
                    <TableHead>Invested</TableHead>
                    <TableHead>Current Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeHoldings.map((holding) => (
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
