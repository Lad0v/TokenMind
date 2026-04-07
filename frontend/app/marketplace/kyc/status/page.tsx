"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Shield,
  XCircle,
} from "lucide-react"

import { Header } from "@/components/user/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSession } from "@/components/providers/session-provider"
import { ApiError, toBackendAssetUrl, userApi, type VerificationCaseResponse } from "@/lib/api"

function getStatusMeta(status: string) {
  switch (status) {
    case "approved":
      return {
        label: "Approved",
        title: "KYS одобрен",
        description: "Покупки токенов на маркетплейсе уже разблокированы.",
        icon: CheckCircle2,
        badgeClassName: "border-primary/30 bg-primary/10 text-primary",
      }
    case "pending":
      return {
        label: "Pending Review",
        title: "KYS на рассмотрении",
        description: "Документы отправлены и ждут проверки администратором.",
        icon: Clock3,
        badgeClassName: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600",
      }
    case "rejected":
      return {
        label: "Rejected",
        title: "KYS отклонен",
        description: "Исправьте пакет документов и отправьте его заново.",
        icon: XCircle,
        badgeClassName: "border-destructive/30 bg-destructive/10 text-destructive",
      }
    case "not_started":
    default:
      return {
        label: "Not Started",
        title: "KYS не начат",
        description: "Для покупки токенов нужно загрузить документ, selfie и адрес проживания.",
        icon: Shield,
        badgeClassName: "border-border bg-secondary/30 text-muted-foreground",
      }
  }
}

function formatDate(value?: string | null) {
  if (!value) {
    return "—"
  }

  return new Date(value).toLocaleString("ru-RU")
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-background/40 px-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  )
}

export default function MarketplaceKysStatusPage() {
  const { status } = useSession()
  const [caseData, setCaseData] = useState<VerificationCaseResponse | null>(null)
  const [verificationStatus, setVerificationStatus] = useState("not_started")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status !== "authenticated") {
      setCaseData(null)
      setVerificationStatus("not_started")
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    void userApi
      .getVerificationStatus()
      .then((payload) => {
        if (cancelled) {
          return
        }
        setCaseData(payload)
        setVerificationStatus(payload.status)
      })
      .catch((caughtError) => {
        if (cancelled) {
          return
        }

        if (caughtError instanceof ApiError && caughtError.status === 404) {
          setCaseData(null)
          setVerificationStatus("not_started")
          return
        }

        setError(caughtError instanceof Error ? caughtError.message : "Не удалось загрузить статус KYS.")
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [status])

  const statusMeta = useMemo(() => getStatusMeta(verificationStatus), [verificationStatus])
  const StatusIcon = statusMeta.icon

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 lg:px-8 py-12 mt-20">
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </main>
      </div>
    )
  }

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 lg:px-8 py-12 mt-20">
          <Card className="mx-auto max-w-2xl">
            <CardHeader>
              <CardTitle>KYS статус доступен после входа</CardTitle>
              <CardDescription>Войдите в investor-аккаунт, чтобы отслеживать проверку документов.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button asChild>
                <Link href="/auth/login">Войти</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/auth/register">Регистрация</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 lg:px-8 py-12 mt-20">
        <div className="mx-auto max-w-3xl space-y-8">
          <section className="text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
              <StatusIcon className="h-10 w-10 text-primary" />
            </div>
            <Badge variant="outline" className={statusMeta.badgeClassName}>
              {statusMeta.label}
            </Badge>
            <h1 className="mt-4 text-3xl font-bold text-foreground">{statusMeta.title}</h1>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{statusMeta.description}</p>
          </section>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>Verification Case</span>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </CardTitle>
              <CardDescription>
                Текущий KYS/KYC status для investor-покупок на маркетплейсе.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow label="Статус" value={verificationStatus.replaceAll("_", " ")} />
              <DetailRow label="Case ID" value={caseData?.id ?? "—"} />
              <DetailRow label="Адрес проживания" value={caseData?.user_address ?? "—"} />
              <DetailRow label="Отправлено" value={formatDate(caseData?.created_at)} />
              <DetailRow label="Проверено" value={formatDate(caseData?.reviewed_at)} />
              <DetailRow label="Комментарий ревьюера" value={caseData?.reviewer_notes ?? "—"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Документы</CardTitle>
              <CardDescription>
                Загруженные файлы остаются в backend verification case и доступны для проверки администратором.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Button variant="outline" asChild disabled={!caseData?.id_document_url}>
                <a href={toBackendAssetUrl(caseData?.id_document_url) ?? "#"} target="_blank" rel="noreferrer">
                  <FileText className="mr-2 h-4 w-4" />
                  ID document
                </a>
              </Button>
              <Button variant="outline" asChild disabled={!caseData?.selfie_url}>
                <a href={toBackendAssetUrl(caseData?.selfie_url) ?? "#"} target="_blank" rel="noreferrer">
                  <FileText className="mr-2 h-4 w-4" />
                  Selfie
                </a>
              </Button>
            </CardContent>
          </Card>

          {verificationStatus === "pending" && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="flex gap-3 pt-6">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600" />
                <p className="text-sm text-muted-foreground">
                  Пока case находится в `pending`, повторная отправка не нужна. Дождитесь review в admin queue.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/marketplace">Вернуться в маркетплейс</Link>
            </Button>
            {(verificationStatus === "not_started" || verificationStatus === "rejected") && (
              <Button asChild>
                <Link href="/marketplace/kyc">
                  {verificationStatus === "rejected" ? "Отправить заново" : "Пройти KYS"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
