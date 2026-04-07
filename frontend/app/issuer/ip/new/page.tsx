"use client"

import { type ChangeEvent, type FormEvent, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Info,
  Loader2,
  Search,
  Upload,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Header } from "@/components/user/header"
import { ApiError, claimsApi, type PatentPrecheckResponse } from "@/lib/api"
import { useRoleGuard } from "@/lib/use-role-guard"

type PreCheckStatus = "idle" | "checking" | "found" | "not_found" | "partial" | "api_error"

const preCheckConfig: Record<
  Exclude<PreCheckStatus, "idle">,
  {
    icon: typeof CheckCircle2
    color: string
    bgColor: string
    borderColor: string
    title: string
    description: string
  }
> = {
  checking: {
    icon: Loader2,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    title: "Проверка патента...",
    description: "Запрос к backend precheck endpoint",
  },
  found: {
    icon: CheckCircle2,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
    title: "Патент найден",
    description: "Данные автоматически подтянуты из precheck snapshot",
  },
  not_found: {
    icon: XCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/30",
    title: "Патент не найден",
    description: "Проверьте номер патента или продолжите вручную",
  },
  partial: {
    icon: AlertCircle,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    title: "Частичное совпадение",
    description: "Часть данных подтянута, но понадобится ручной review",
  },
  api_error: {
    icon: AlertCircle,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    title: "Сервис недоступен",
    description: "Backend не смог выполнить precheck",
  },
}

export default function NewPatentClaimPage() {
  const router = useRouter()
  const { status, isAuthorized } = useRoleGuard(["issuer", "user", "admin"])

  const [preCheckStatus, setPreCheckStatus] = useState<PreCheckStatus>("idle")
  const [precheckSnapshot, setPrecheckSnapshot] = useState<PatentPrecheckResponse | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<File[]>([])
  const [formData, setFormData] = useState({
    patentNumber: "",
    patentTitle: "",
    claimedOwnerName: "",
    description: "",
    jurisdiction: "US",
  })

  const selectedFilesLabel = useMemo(
    () => (documents.length ? documents.map((file) => file.name).join(", ") : "Файлы не выбраны"),
    [documents],
  )

  if (status === "loading" || !isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading claim form...
      </div>
    )
  }

  const handlePreCheck = async () => {
    if (!formData.patentNumber) {
      return
    }

    setError(null)
    setPreCheckStatus("checking")

    try {
      const result = await claimsApi.precheck({
        patent_number: formData.patentNumber,
        jurisdiction: formData.jurisdiction,
        claimed_owner_name: formData.claimedOwnerName || undefined,
      })

      setPrecheckSnapshot(result)
      setFormData((current) => ({
        ...current,
        patentTitle: result.title || current.patentTitle,
        claimedOwnerName: result.owner || current.claimedOwnerName,
      }))

      if (result.status === "found") {
        setPreCheckStatus("found")
      } else if (result.status === "partial") {
        setPreCheckStatus("partial")
      } else if (result.status === "not_found") {
        setPreCheckStatus("not_found")
      } else {
        setPreCheckStatus("api_error")
      }
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message)
      } else if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError("Не удалось выполнить precheck.")
      }
      setPreCheckStatus("api_error")
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDocuments(Array.from(event.target.files ?? []))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const claim = await claimsApi.create({
        patent_number: formData.patentNumber,
        patent_title: formData.patentTitle || undefined,
        claimed_owner_name: formData.claimedOwnerName,
        description: formData.description || undefined,
        jurisdiction: formData.jurisdiction || undefined,
        precheck_snapshot:
          precheckSnapshot && precheckSnapshot.prechecked
            ? {
                status: precheckSnapshot.status,
                source_id: precheckSnapshot.source_id,
                metadata: precheckSnapshot.metadata,
              }
            : undefined,
      })

      for (const file of documents) {
        await claimsApi.uploadDocument(claim.id, file, "supporting_document")
      }

      router.push(`/issuer/ip/${claim.id}`)
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message)
      } else if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError("Не удалось создать patent claim.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeConfig = preCheckStatus !== "idle" ? preCheckConfig[preCheckStatus] : null

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 lg:px-8 py-8 mt-20">
        <div className="max-w-2xl mx-auto">
          <Link
            href="/issuer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад в кабинет
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Подача patent claim</h1>
            <p className="text-muted-foreground">
              Форма отправляет данные в реальный `/api/v1/ip-claims` и использует backend precheck.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="p-6 rounded-xl border border-border bg-card/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  1
                </div>
                <h2 className="text-lg font-semibold text-foreground">Проверка патента</h2>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[1fr_140px]">
                  <div className="space-y-2">
                    <Label htmlFor="patentNumber" className="text-xs uppercase tracking-wider text-muted-foreground">
                      Номер патента
                    </Label>
                    <Input
                      id="patentNumber"
                      value={formData.patentNumber}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, patentNumber: event.target.value }))
                      }
                      placeholder="US1234567"
                      className="h-12 bg-card border-border"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jurisdiction" className="text-xs uppercase tracking-wider text-muted-foreground">
                      Юрисдикция
                    </Label>
                    <Input
                      id="jurisdiction"
                      value={formData.jurisdiction}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, jurisdiction: event.target.value.toUpperCase() }))
                      }
                      className="h-12 bg-card border-border"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handlePreCheck}
                  disabled={!formData.patentNumber || preCheckStatus === "checking"}
                  className="h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {preCheckStatus === "checking" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Проверить
                    </>
                  )}
                </Button>

                {activeConfig && (
                  <div className={`p-4 rounded-lg ${activeConfig.bgColor} border ${activeConfig.borderColor}`}>
                    <div className="flex items-start gap-3">
                      <activeConfig.icon
                        className={`h-5 w-5 ${activeConfig.color} flex-shrink-0 mt-0.5 ${
                          preCheckStatus === "checking" ? "animate-spin" : ""
                        }`}
                      />
                      <div>
                        <p className={`text-sm font-medium ${activeConfig.color}`}>{activeConfig.title}</p>
                        <p className="text-xs text-muted-foreground">{activeConfig.description}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Текущий precheck опирается на существующий backend endpoint `/api/v1/ip/precheck`. Для production
                    рекомендуется перевести этот экран на международный IP Intelligence flow.
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  2
                </div>
                <h2 className="text-lg font-semibold text-foreground">Данные патента</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="patentTitle" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Название патента
                  </Label>
                  <Input
                    id="patentTitle"
                    value={formData.patentTitle}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, patentTitle: event.target.value }))
                    }
                    placeholder="Введите название или выполните precheck"
                    className="h-12 bg-card border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="claimedOwnerName"
                    className="text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    Имя правообладателя
                  </Label>
                  <Input
                    id="claimedOwnerName"
                    value={formData.claimedOwnerName}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, claimedOwnerName: event.target.value }))
                    }
                    placeholder="ООО Example Labs"
                    className="h-12 bg-card border-border"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Описание
                  </Label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, description: event.target.value }))
                    }
                    className="min-h-32 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition focus:border-primary"
                    placeholder="Краткое описание прав и контекста заявки"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  3
                </div>
                <h2 className="text-lg font-semibold text-foreground">Поддерживающие документы</h2>
              </div>

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/50 px-6 py-8 text-center">
                <Upload className="h-5 w-5 text-muted-foreground mb-3" />
                <span className="text-sm text-foreground">Загрузите один или несколько файлов</span>
                <span className="text-xs text-muted-foreground mt-1">{selectedFilesLabel}</span>
                <input type="file" multiple className="hidden" onChange={handleFileChange} />
              </label>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="outline" asChild>
                <Link href="/issuer">Отмена</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Создать заявку"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
