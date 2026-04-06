"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Wallet, TrendingUp, PieChart, Clock3 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Tab = "overview" | "tokens" | "history"

type Holding = {
  asset: string
  ticker: string
  tokens: number
  avgPrice: number
  currentPrice: number
  status: "active" | "tokenized" | "under_review"
}

const holdings: Holding[] = [
  { asset: "NanoSeal Patent", ticker: "NSP", tokens: 190, avgPrice: 0.41, currentPrice: 0.5, status: "active" },
  { asset: "BioInk Formula", ticker: "BIF", tokens: 120, avgPrice: 0.36, currentPrice: 0.49, status: "active" },
  { asset: "Photon Core", ticker: "PHC", tokens: 60, avgPrice: 0.88, currentPrice: 1.1, status: "tokenized" },
  { asset: "Quantum Print Stack", ticker: "QPS", tokens: 75, avgPrice: 0.52, currentPrice: 0.47, status: "under_review" },
]

const txHistory = [
  { id: "TX-9821", date: "31 Mar 2026", asset: "NanoSeal Patent", action: "BUY", amount: "40 NSP", total: "20.0 SOL" },
  { id: "TX-9765", date: "28 Mar 2026", asset: "Photon Core", action: "BUY", amount: "15 PHC", total: "16.5 SOL" },
  { id: "TX-9680", date: "25 Mar 2026", asset: "BioInk Formula", action: "BUY", amount: "35 BIF", total: "17.2 SOL" },
]

export default function InvestorPortfolioPage() {
  const [tab, setTab] = useState<Tab>("overview")

  const stats = useMemo(() => {
    const invested = holdings.reduce((sum, h) => sum + h.tokens * h.avgPrice, 0)
    const current = holdings.reduce((sum, h) => sum + h.tokens * h.currentPrice, 0)
    const pnl = current - invested
    const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0

    return { invested, current, pnl, pnlPercent }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-2">
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10">Investor area</Badge>
            <h1 className="text-3xl lg:text-4xl font-bold">Портфель инвестора</h1>
            <p className="text-muted-foreground max-w-2xl">
              Здесь видны купленные токены, средняя цена входа, текущая стоимость и доходность портфеля.
            </p>
          </div>

          <Button variant="outline" asChild>
            <Link href="/marketplace">
              <ArrowLeft className="h-4 w-4 mr-2" />
              В маркетплейс
            </Link>
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>Обзор</TabButton>
          <TabButton active={tab === "tokens"} onClick={() => setTab("tokens")}>Купленные токены</TabButton>
          <TabButton active={tab === "history"} onClick={() => setTab("history")}>История сделок</TabButton>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon={Wallet} label="Текущая стоимость" value={`${stats.current.toFixed(2)} SOL`} />
          <StatCard icon={PieChart} label="Вложено" value={`${stats.invested.toFixed(2)} SOL`} />
          <StatCard icon={TrendingUp} label="PnL" value={`${stats.pnl >= 0 ? "+" : ""}${stats.pnl.toFixed(2)} SOL`} valueClass={stats.pnl >= 0 ? "text-emerald-400" : "text-red-400"} />
          <StatCard icon={Clock3} label="Доходность" value={`${stats.pnl >= 0 ? "+" : ""}${stats.pnlPercent.toFixed(2)}%`} valueClass={stats.pnl >= 0 ? "text-emerald-400" : "text-red-400"} />
        </div>

        {tab === "overview" && (
          <Card>
            <CardHeader>
              <CardTitle>Ключевые позиции</CardTitle>
              <CardDescription>Топ активов по текущей стоимости.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Тикер</TableHead>
                    <TableHead>Токены</TableHead>
                    <TableHead>Средняя цена</TableHead>
                    <TableHead>Текущая цена</TableHead>
                    <TableHead>PnL</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((h) => {
                    const pnl = (h.currentPrice - h.avgPrice) * h.tokens
                    return (
                      <TableRow key={h.ticker}>
                        <TableCell className="font-medium">{h.asset}</TableCell>
                        <TableCell>{h.ticker}</TableCell>
                        <TableCell>{h.tokens}</TableCell>
                        <TableCell>{h.avgPrice.toFixed(2)} SOL</TableCell>
                        <TableCell>{h.currentPrice.toFixed(2)} SOL</TableCell>
                        <TableCell className={pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} SOL
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize border-primary/30 bg-primary/10 text-primary">{h.status.replaceAll("_", " ")}</Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {tab === "tokens" && (
          <Card>
            <CardHeader>
              <CardTitle>Купленные токены</CardTitle>
              <CardDescription>Список всех позиций инвестора по токенизированным IP.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Тикер</TableHead>
                    <TableHead>Количество</TableHead>
                    <TableHead>Текущая цена</TableHead>
                    <TableHead>Стоимость позиции</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((h) => (
                    <TableRow key={h.ticker}>
                      <TableCell className="font-medium">{h.asset}</TableCell>
                      <TableCell>{h.ticker}</TableCell>
                      <TableCell>{h.tokens} токенов</TableCell>
                      <TableCell>{h.currentPrice.toFixed(2)} SOL</TableCell>
                      <TableCell>{(h.tokens * h.currentPrice).toFixed(2)} SOL</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {tab === "history" && (
          <Card>
            <CardHeader>
              <CardTitle>История операций</CardTitle>
              <CardDescription>Последние транзакции по вашему портфелю.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Действие</TableHead>
                    <TableHead>Объем</TableHead>
                    <TableHead>Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txHistory.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{tx.id}</TableCell>
                      <TableCell>{tx.date}</TableCell>
                      <TableCell className="font-medium">{tx.asset}</TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40">{tx.action}</Badge>
                      </TableCell>
                      <TableCell>{tx.amount}</TableCell>
                      <TableCell>{tx.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function TabButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className={active ? "bg-primary text-primary-foreground" : ""}
    >
      {children}
    </Button>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <p className={`text-2xl font-semibold ${valueClass ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
