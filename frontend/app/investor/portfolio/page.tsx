"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, PieChart, TrendingUp, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Header } from "@/components/user/header";
import { apiClient, PortfolioHolding, TradeHistoryItem } from "@/lib/api-client";
import { lamportsToSol } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

type Tab = "overview" | "tokens" | "history";

export default function InvestorPortfolioPage() {
  const { user, accessToken, isReady } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [trades, setTrades] = useState<TradeHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (!accessToken || user?.role !== "investor") {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [holdingsResponse, tradesResponse] = await Promise.all([
          apiClient.getPortfolioHoldings(accessToken),
          apiClient.getPortfolioTrades(accessToken),
        ]);
        setHoldings(holdingsResponse.items);
        setTrades(tradesResponse.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить портфель");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [accessToken, isReady, user?.role]);

  const stats = useMemo(() => {
    const invested = holdings.reduce((sum, item) => sum + item.invested_lamports, 0);
    const current = holdings.reduce((sum, item) => sum + (item.current_value_lamports ?? 0), 0);
    const pnl = current - invested;
    const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
    return { invested, current, pnl, pnlPercent };
  }, [holdings]);

  if (!isReady || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 lg:px-8 py-24 text-center text-muted-foreground">
          Загрузка портфеля...
        </div>
      </div>
    );
  }

  if (!user || user.role !== "investor" || !accessToken) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 lg:px-8 py-24">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card/50 p-8 text-center">
            <h1 className="text-3xl font-bold text-foreground mb-3">Портфель инвестора</h1>
            <p className="text-muted-foreground mb-6">
              Этот раздел доступен только investor-аккаунтам после wallet login.
            </p>
            <Button asChild>
              <Link href="/auth/login">Войти</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 lg:px-8 py-8 mt-20 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-2">
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10">Investor area</Badge>
            <h1 className="text-3xl lg:text-4xl font-bold">Портфель инвестора</h1>
            <p className="text-muted-foreground max-w-2xl">
              Здесь отражаются подтверждённые `buy_shares` receipts и агрегированные holdings из backend mirror.
            </p>
          </div>

          <Button variant="outline" asChild>
            <Link href="/marketplace">
              <ArrowLeft className="h-4 w-4 mr-2" />
              В маркетплейс
            </Link>
          </Button>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>Обзор</TabButton>
          <TabButton active={tab === "tokens"} onClick={() => setTab("tokens")}>Купленные shares</TabButton>
          <TabButton active={tab === "history"} onClick={() => setTab("history")}>История сделок</TabButton>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon={Wallet} label="Текущая стоимость" value={`${lamportsToSol(stats.current)} SOL`} />
          <StatCard icon={PieChart} label="Вложено" value={`${lamportsToSol(stats.invested)} SOL`} />
          <StatCard icon={TrendingUp} label="PnL" value={`${stats.pnl >= 0 ? "+" : ""}${lamportsToSol(stats.pnl)} SOL`} valueClass={stats.pnl >= 0 ? "text-emerald-400" : "text-red-400"} />
          <StatCard icon={Clock3} label="Доходность" value={`${stats.pnl >= 0 ? "+" : ""}${stats.pnlPercent.toFixed(2)}%`} valueClass={stats.pnl >= 0 ? "text-emerald-400" : "text-red-400"} />
        </div>

        {tab === "overview" && (
          <Card>
            <CardHeader>
              <CardTitle>Ключевые позиции</CardTitle>
              <CardDescription>Сводный вид по токенизированным IP assets.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Patent</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Avg buy</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>PnL</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((holding) => {
                    const pnl = (holding.current_value_lamports ?? 0) - holding.invested_lamports;
                    return (
                      <TableRow key={holding.tokenization_id}>
                        <TableCell className="font-medium">{holding.asset_name}</TableCell>
                        <TableCell>{holding.patent_number}</TableCell>
                        <TableCell>{holding.quantity}</TableCell>
                        <TableCell>{lamportsToSol(holding.average_price_lamports)} SOL</TableCell>
                        <TableCell>{holding.current_price_lamports ? `${lamportsToSol(holding.current_price_lamports)} SOL` : "—"}</TableCell>
                        <TableCell className={pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {pnl >= 0 ? "+" : ""}{lamportsToSol(pnl)} SOL
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize border-primary/30 bg-primary/10 text-primary">
                            {holding.listing_status ?? "—"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {tab === "tokens" && (
          <Card>
            <CardHeader>
              <CardTitle>Купленные shares</CardTitle>
              <CardDescription>Текущие позиции по всем подтверждённым `buy_shares` receipts.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Avg buy</TableHead>
                    <TableHead>Invested</TableHead>
                    <TableHead>Current value</TableHead>
                    <TableHead>Mint</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((holding) => (
                    <TableRow key={holding.tokenization_id}>
                      <TableCell className="font-medium">{holding.asset_name}</TableCell>
                      <TableCell>{holding.quantity}</TableCell>
                      <TableCell>{lamportsToSol(holding.average_price_lamports)} SOL</TableCell>
                      <TableCell>{lamportsToSol(holding.invested_lamports)} SOL</TableCell>
                      <TableCell>{holding.current_value_lamports ? `${lamportsToSol(holding.current_value_lamports)} SOL` : "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{holding.mint_address ?? "—"}</TableCell>
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
              <CardDescription>Подтверждённые backend mirror записи по primary purchases.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((trade) => (
                    <TableRow key={trade.transaction.id}>
                      <TableCell className="font-medium">{trade.asset_name}</TableCell>
                      <TableCell className="font-mono text-xs">{trade.transaction.tx_signature ?? "pending"}</TableCell>
                      <TableCell>{trade.transaction.quantity ?? "—"}</TableCell>
                      <TableCell>{trade.transaction.gross_amount_lamports ? `${lamportsToSol(trade.transaction.gross_amount_lamports)} SOL` : "—"}</TableCell>
                      <TableCell>{trade.transaction.fee_amount_lamports ? `${lamportsToSol(trade.transaction.fee_amount_lamports)} SOL` : "0 SOL"}</TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40">
                          {trade.transaction.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant={active ? "default" : "outline"} onClick={onClick} className={active ? "bg-primary text-primary-foreground" : ""}>
      {children}
    </Button>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClass?: string;
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
  );
}
