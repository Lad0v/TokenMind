"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Clock, Coins, FileText, Plus, Shield } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/user/header"
import { claimsApi, type IpClaim, ApiError } from "@/lib/api"
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
  const { status, user, isAuthorized } = useRoleGuard(["issuer", "investor", "user", "admin"])
  const [claims, setClaims] = useState<IpClaim[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthorized) {
      return
    }

    let isCancelled = false

    const loadClaims = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await claimsApi.list()
        if (!isCancelled) {
          setClaims(response.items)
        }
      } catch (caughtError) {
        if (isCancelled) {
          return
        }

        if (caughtError instanceof ApiError) {
          setError(caughtError.message)
        } else if (caughtError instanceof Error) {
          setError(caughtError.message)
        } else {
          setError("Не удалось загрузить список заявок.")
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadClaims()
    return () => {
      isCancelled = true
    }
  }, [isAuthorized])

  const stats = useMemo(
    () => [
      { label: "Всего заявок", value: claims.length, icon: FileText },
      { label: "На проверке", value: claims.filter((claim) => claim.status === "under_review").length, icon: Clock },
      { label: "Одобрено", value: claims.filter((claim) => claim.status === "approved").length, icon: CheckCircle2 },
      { label: "Токенизировано", value: 0, icon: Coins },
    ],
    [claims],
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
              Управляйте своими patent claims и отслеживайте review workflow
            </p>
          </div>

          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground w-fit">
            <Link href="/issuer/ip/new">
              <Plus className="h-4 w-4 mr-2" />
              Подать патент
            </Link>
          </Button>
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
                          <span className="text-sm text-muted-foreground">
                            {new Date(claim.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/issuer/ip/${claim.id}`}>Открыть</Link>
                          </Button>
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
          <h2 className="text-lg font-semibold text-foreground mb-2">Внешние модули</h2>
          <p className="text-sm text-muted-foreground">
            Токенизация, маркетплейс и asset management пока остаются внешними модулями. Для них нужен отдельный
            backend-контур: assets, tokenization, listings и portfolio APIs.
          </p>
        </section>
      </main>
    </div>
  )
}
