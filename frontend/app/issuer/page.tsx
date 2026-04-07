"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Coins,
  FileText,
  Shield,
  Wallet,
  XCircle,
} from "lucide-react";

import { Header } from "@/components/user/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient, IpClaim, TokenizedAsset } from "@/lib/api-client";
import { formatDate, lamportsToSol } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

const claimStatusMap: Record<string, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  draft: { label: "Черновик", tone: "bg-muted text-muted-foreground", icon: FileText },
  submitted: { label: "Отправлено", tone: "bg-blue-500/10 text-blue-500", icon: Clock },
  prechecked: { label: "API pre-check", tone: "bg-cyan-500/10 text-cyan-500", icon: Shield },
  awaiting_kyc: { label: "Ожидание KYC", tone: "bg-orange-500/10 text-orange-500", icon: Clock },
  under_review: { label: "На проверке", tone: "bg-yellow-500/10 text-yellow-500", icon: Clock },
  approved: { label: "Одобрено", tone: "bg-primary/10 text-primary", icon: CheckCircle2 },
  rejected: { label: "Отклонено", tone: "bg-destructive/10 text-destructive", icon: XCircle },
};

const tokenizationStatusMap: Record<string, string> = {
  draft: "Подготовка",
  asset_initialized: "Asset initialized",
  minted: "Minted",
  mint_authority_revoked: "Mint authority revoked",
  fraction_configured: "Fraction configured",
  sale_supply_deposited: "Sale deposited",
  fraction_model_locked: "Fraction locked",
  listed: "Listed",
  paused: "Paused",
  closed: "Closed",
  failed: "Failed",
};

export default function IssuerDashboardPage() {
  const { user, accessToken, isReady } = useAuth();
  const [claims, setClaims] = useState<IpClaim[]>([]);
  const [tokenizations, setTokenizations] = useState<TokenizedAsset[]>([]);
  const [activeTab, setActiveTab] = useState<"claims" | "assets">("claims");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (!accessToken || user?.role !== "issuer") {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [claimsResponse, tokenizationsResponse] = await Promise.all([
          apiClient.listIpClaims(accessToken),
          apiClient.listTokenizations(accessToken),
        ]);
        setClaims(claimsResponse.items);
        setTokenizations(tokenizationsResponse.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить кабинет правообладателя");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [accessToken, isReady, user?.role]);

  const tokenizationByClaimId = useMemo(() => {
    return new Map(tokenizations.map((item) => [item.claim.id, item]));
  }, [tokenizations]);

  const stats = useMemo(() => {
    const approvedClaims = claims.filter((claim) => claim.status === "approved").length;
    const listedAssets = tokenizations.filter((item) => item.listing?.status === "active").length;
    return [
      { label: "Всего заявок", value: claims.length, icon: FileText },
      { label: "Одобрено", value: approvedClaims, icon: CheckCircle2 },
      { label: "Токенизировано", value: tokenizations.length, icon: Coins },
      { label: "Активных листингов", value: listedAssets, icon: Wallet },
    ];
  }, [claims, tokenizations]);

  if (!isReady || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 lg:px-8 py-24">
          <div className="rounded-xl border border-border bg-card/50 p-8 text-center text-muted-foreground">
            Загрузка кабинета правообладателя...
          </div>
        </main>
      </div>
    );
  }

  if (!user || !accessToken) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 lg:px-8 py-24">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card/60 p-8 text-center">
            <h1 className="text-3xl font-bold text-foreground mb-3">Кабинет правообладателя</h1>
            <p className="text-muted-foreground mb-6">
              Авторизуйтесь через Solana-кошелёк, чтобы управлять одобренными IP claims и запускать on-chain tokenization.
            </p>
            <div className="flex justify-center gap-3">
              <Button asChild>
                <Link href="/auth/login">Войти</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/auth/register">Регистрация</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (user.role !== "issuer") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 lg:px-8 py-24">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card/60 p-8 text-center">
            <h1 className="text-3xl font-bold text-foreground mb-3">Требуется роль issuer</h1>
            <p className="text-muted-foreground">
              Этот раздел доступен только правообладателям с завершённой верификацией и одобренными IP claims.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 lg:px-8 py-8 mt-20">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Кабинет правообладателя</h1>
            <p className="text-muted-foreground">
              Одобренные claims можно перевести в on-chain lifecycle из модуля `certs`.
            </p>
          </div>

          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground w-fit">
            <Link href="/issuer/ip/new">Подать патент</Link>
          </Button>
        </div>

        <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 mb-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  Статус верификации: {user.verification_status ?? "not_started"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Tokenization разрешена только после `approved` verification и `approved` IP claim.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
              {user.verification_status ?? "unverified"}
            </Badge>
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

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4 border-b border-border mb-6">
          <button
            onClick={() => setActiveTab("claims")}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "claims"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Claims ({claims.length})
          </button>
          <button
            onClick={() => setActiveTab("assets")}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "assets"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Tokenized assets ({tokenizations.length})
          </button>
        </div>

        {activeTab === "claims" && (
          <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Патент</th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Название</th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Claim</th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Blockchain</th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Обновлено</th>
                    <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => {
                    const status = claimStatusMap[claim.status] ?? claimStatusMap.draft;
                    const StatusIcon = status.icon;
                    const tokenization = tokenizationByClaimId.get(claim.id);
                    return (
                      <tr key={claim.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="p-4">
                          <code className="text-sm text-foreground font-mono">{claim.patent_number}</code>
                        </td>
                        <td className="p-4 text-sm text-foreground max-w-sm">
                          <div className="line-clamp-2">{claim.patent_title ?? "Без названия"}</div>
                        </td>
                        <td className="p-4">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${status.tone}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">{status.label}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          {tokenization ? (
                            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                              {tokenizationStatusMap[tokenization.status] ?? tokenization.status}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not started</span>
                          )}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">{formatDate(claim.updated_at)}</td>
                        <td className="p-4 text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/issuer/ip/${claim.id}`}>
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {claims.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                        Claims пока не найдены.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "assets" && (
          <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Asset ID</th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Патент</th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Статус</th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Shares</th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Листинг</th>
                    <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {tokenizations.map((tokenization) => (
                    <tr key={tokenization.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="p-4">
                        <code className="text-sm text-foreground font-mono">{tokenization.asset_id}</code>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-foreground">{tokenization.claim.patent_title ?? tokenization.claim.patent_number}</div>
                        <div className="text-xs text-muted-foreground">{tokenization.claim.patent_number}</div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                          {tokenizationStatusMap[tokenization.status] ?? tokenization.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-foreground">
                        {tokenization.sale_supply} / {tokenization.total_shares}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {tokenization.listing
                          ? `${lamportsToSol(tokenization.listing.price_per_share_lamports)} SOL/share`
                          : "Ещё не создан"}
                      </td>
                      <td className="p-4 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/issuer/ip/${tokenization.claim.id}`}>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {tokenizations.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                        On-chain tokenization пока не запускалась.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
