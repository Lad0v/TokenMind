"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { IPChainLogo } from "@/components/ipchain-logo"
import {Header} from "@/components/user/header";
import { 
  Plus, 
  FileText, 
  Coins, 
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  MoreHorizontal,
  Search,
  Filter,
  Shield,
  TrendingUp,
  Wallet
} from "lucide-react"

const mockClaims = [
  {
    id: "1",
    patentNumber: "RU2789456",
    patentTitle: "Способ обработки данных в распределённой системе",
    status: "approved",
    createdAt: "2026-03-15",
    lastUpdate: "2026-03-28"
  },
  {
    id: "2",
    patentNumber: "RU2791234",
    patentTitle: "Устройство для автоматизированного тестирования",
    status: "under_review",
    createdAt: "2026-03-25",
    lastUpdate: "2026-03-30"
  },
  {
    id: "3",
    patentNumber: "RU2792567",
    patentTitle: "Метод оптимизации нейронных сетей",
    status: "prechecked",
    createdAt: "2026-04-01",
    lastUpdate: "2026-04-01"
  },
  {
    id: "4",
    patentNumber: "RU2785890",
    patentTitle: "Система умного контроля доступа",
    status: "rejected",
    createdAt: "2026-02-10",
    lastUpdate: "2026-02-20"
  }
]

const mockAssets = [
  {
    id: "1",
    patentNumber: "RU2789456",
    title: "Способ обработки данных в распределённой системе",
    status: "listed",
    tokensMinted: 1000,
    tokensAvailable: 850
  }
]

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: typeof CheckCircle2 }> = {
  draft: { label: "Черновик", color: "text-muted-foreground", bgColor: "bg-muted", icon: FileText },
  submitted: { label: "Отправлено", color: "text-blue-500", bgColor: "bg-blue-500/10", icon: Clock },
  prechecked: { label: "Проверено API", color: "text-cyan-500", bgColor: "bg-cyan-500/10", icon: Shield },
  awaiting_kyc: { label: "Ожидание KYC", color: "text-orange-500", bgColor: "bg-orange-500/10", icon: AlertCircle },
  under_review: { label: "На проверке", color: "text-yellow-500", bgColor: "bg-yellow-500/10", icon: Clock },
  approved: { label: "Одобрено", color: "text-primary", bgColor: "bg-primary/10", icon: CheckCircle2 },
  rejected: { label: "Отклонено", color: "text-destructive", bgColor: "bg-destructive/10", icon: XCircle }
}

export default function IssuerDashboardPage() {
  const [activeTab, setActiveTab] = useState<"claims" | "assets">("claims")

  const stats = [
    { label: "Всего заявок", value: mockClaims.length, icon: FileText },
    { label: "На проверке", value: mockClaims.filter(c => c.status === "under_review").length, icon: Clock },
    { label: "Одобрено", value: mockClaims.filter(c => c.status === "approved").length, icon: CheckCircle2 },
    { label: "Токенизировано", value: mockAssets.length, icon: Coins }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}

      <Header/>

      <main className="container mx-auto px-4 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Кабинет правообладателя</h1>
            <p className="text-muted-foreground">
              Управляйте своими патентами и токенизированными активами
            </p>
          </div>
          
          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground w-fit">
            <Link href="/issuer/ip/new">
              <Plus className="h-4 w-4 mr-2" />
              Подать патент
            </Link>
          </Button>
        </div>

        {/* Stats */}
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

        {/* KYC Notice (if needed) */}
        <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">KYC верификация пройдена</p>
                <p className="text-sm text-muted-foreground">Вы можете токенизировать свои активы</p>
              </div>
            </div>
            <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
              Verified
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 border-b border-border mb-6">
          <button
            onClick={() => setActiveTab("claims")}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "claims"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Мои заявки ({mockClaims.length})
          </button>
          <button
            onClick={() => setActiveTab("assets")}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "assets"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Мои активы ({mockAssets.length})
          </button>
        </div>

        {/* Claims Table */}
        {activeTab === "claims" && (
          <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Патент
                    </th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Название
                    </th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Статус
                    </th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Создано
                    </th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Обновлено
                    </th>
                    <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mockClaims.map((claim) => {
                    const status = statusConfig[claim.status]
                    const StatusIcon = status.icon
                    return (
                      <tr key={claim.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="p-4">
                          <code className="text-sm text-foreground font-mono">{claim.patentNumber}</code>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-foreground line-clamp-1 max-w-xs">{claim.patentTitle}</p>
                        </td>
                        <td className="p-4">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${status.bgColor}`}>
                            <StatusIcon className={`h-3.5 w-3.5 ${status.color}`} />
                            <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-muted-foreground">{claim.createdAt}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-muted-foreground">{claim.lastUpdate}</span>
                        </td>
                        <td className="p-4 text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/issuer/ip/${claim.id}`}>
                              <span className="sr-only">Открыть</span>
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Assets Table */}
        {activeTab === "assets" && (
          <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Патент
                    </th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Название
                    </th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Статус
                    </th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Токены
                    </th>
                    <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mockAssets.map((asset) => (
                    <tr key={asset.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="p-4">
                        <code className="text-sm text-foreground font-mono">{asset.patentNumber}</code>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-foreground line-clamp-1 max-w-xs">{asset.title}</p>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
                          На маркетплейсе
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-foreground">{asset.tokensAvailable}</span>
                          <span className="text-sm text-muted-foreground">/ {asset.tokensMinted}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/issuer/assets/${asset.id}`}>
                            <span className="sr-only">Открыть</span>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {mockAssets.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Coins className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Нет токенизированных активов</h3>
                <p className="text-muted-foreground mb-4">
                  Сначала подайте заявку на патент и дождитесь одобрения
                </p>
                <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Link href="/issuer/ip/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Подать патент
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
