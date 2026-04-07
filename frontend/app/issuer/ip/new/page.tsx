"use client"

import { type ChangeEvent, type FormEvent, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, CheckCircle2, Info, Loader2, Search, Upload, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Header } from "@/components/user/header"
import { ApiError, authApi, claimsApi } from "@/lib/api"
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
    title: "Проверяем патент",
    description: "Запрос отправлен в /api/v1/patents/precheck/international",
  },
  found: {
    icon: CheckCircle2,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
    title: "Патент найден",
    description: "Данные подтянуты из международного precheck.",
  },
  not_found: {
    icon: XCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/30",
    title: "Патент не найден",
    description: "Проверьте номер и код страны или заполните поля вручную.",
  },
  partial: {
    icon: AlertCircle,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    title: "Нужна ручная проверка",
    description: "Ответ получен, но для решения потребуется ручной review.",
  },
  api_error: {
    icon: AlertCircle,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    title: "Precheck недоступен",
    description: "Сервис временно недоступен. Можно продолжить вручную.",
  },
}

export default function NewPatentClaimPage() {
  const router = useRouter()
  const { status, isAuthorized } = useRoleGuard(["investor", "issuer", "admin"])

  const [preCheckStatus, setPreCheckStatus] = useState<PreCheckStatus>("idle")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<File[]>([])
  const [otpCode, setOtpCode] = useState("")
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    patentNumber: "",
    patentTitle: "",
    claimedOwnerName: "",
    description: "",
    jurisdiction: "US",
    email: "",
    phone: "",
  })

  const selectedFilesLabel = useMemo(
    () => (documents.length ? documents.map((file) => file.name).join(", ") : "Файлы не выбраны"),
    [documents],
  )

  const activeConfig = preCheckStatus !== "idle" ? preCheckConfig[preCheckStatus] : null

  if (status === "loading" || !isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading claim form...
      </div>
    )
  }

  const handlePreCheck = async () => {
    if (!formData.patentNumber.trim()) {
      return
    }

    setError(null)
    setPreCheckStatus("checking")

    try {
      const result = await claimsApi.precheck({
        patent_number: formData.patentNumber.trim(),
        country_code: formData.jurisdiction.trim().toUpperCase() || "US",
        include_analytics: true,
      })

      const suggestedTitle = result.normalized_record?.title ?? ""
      const suggestedOwner = result.normalized_record?.assignees?.[0]?.name ?? ""

      setFormData((current) => ({
        ...current,
        patentTitle: current.patentTitle || suggestedTitle,
        claimedOwnerName: current.claimedOwnerName || suggestedOwner,
      }))

      if (!result.exists) {
        setPreCheckStatus("not_found")
      } else if (result.recommendation === "recommended") {
        setPreCheckStatus("found")
      } else {
        setPreCheckStatus("partial")
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
      const result = await authApi.submitPatent({
        patent_number: formData.patentNumber.trim(),
        patent_title: formData.patentTitle.trim(),
        claimed_owner_name: formData.claimedOwnerName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        description: formData.description.trim() || undefined,
        jurisdiction: formData.jurisdiction.trim().toUpperCase() || "US",
      })

      setSubmissionId(result.submission_id)
      setOtpSentTo(result.otp_sent_to)
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message)
      } else if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError("Не удалось отправить заявку.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!submissionId) {
      return
    }
    if (!otpCode.trim()) {
      setError("Введите OTP-код из письма.")
      return
    }

    setError(null)
    setIsVerifyingOtp(true)

    try {
      await authApi.verifySubmitPatentOtp({
        email: formData.email.trim(),
        code: otpCode.trim(),
        submission_id: submissionId,
      })

      for (const file of documents) {
        await claimsApi.uploadDocument(submissionId, file, "supporting_document")
      }

      router.push(`/issuer/ip/${submissionId}`)
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message)
      } else if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError("Не удалось подтвердить OTP.")
      }
    } finally {
      setIsVerifyingOtp(false)
    }
  }

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
            <h1 className="text-3xl font-bold text-foreground mb-2">Подача патента</h1>
            <p className="text-muted-foreground">
              Новый flow: `/auth/submit-patent` + OTP верификация через `/auth/submit-patent/verify-otp`.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="p-6 rounded-xl border border-border bg-card/50 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  1
                </div>
                <h2 className="text-lg font-semibold text-foreground">Precheck патента</h2>
              </div>

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
                    Код страны
                  </Label>
                  <Input
                    id="jurisdiction"
                    value={formData.jurisdiction}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, jurisdiction: event.target.value.toUpperCase() }))
                    }
                    className="h-12 bg-card border-border"
                    placeholder="US"
                    maxLength={3}
                  />
                </div>
              </div>

              <Button
                type="button"
                onClick={handlePreCheck}
                disabled={!formData.patentNumber.trim() || preCheckStatus === "checking"}
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
                <span>Endpoint: `/api/v1/patents/precheck/international`.</span>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card/50 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  2
                </div>
                <h2 className="text-lg font-semibold text-foreground">Данные заявки</h2>
              </div>

              <div className="space-y-2">
                <Label htmlFor="patentTitle" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Название патента
                </Label>
                <Input
                  id="patentTitle"
                  value={formData.patentTitle}
                  onChange={(event) => setFormData((current) => ({ ...current, patentTitle: event.target.value }))}
                  className="h-12 bg-card border-border"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="claimedOwnerName" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Правообладатель
                </Label>
                <Input
                  id="claimedOwnerName"
                  value={formData.claimedOwnerName}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, claimedOwnerName: event.target.value }))
                  }
                  className="h-12 bg-card border-border"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Email для OTP
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                    className="h-12 bg-card border-border"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Телефон для OTP
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(event) => setFormData((current) => ({ ...current, phone: event.target.value }))}
                    className="h-12 bg-card border-border"
                    placeholder="+79991234567"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Описание
                </Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-28 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition focus:border-primary"
                  placeholder="Краткое описание прав и контекста заявки"
                />
              </div>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card/50 space-y-4">
              <div className="flex items-center gap-3">
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
              <p className="text-xs text-muted-foreground">
                Файлы будут загружены после успешной OTP-верификации.
              </p>
            </div>

            {submissionId && (
              <div className="p-6 rounded-xl border border-primary/30 bg-primary/5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                    4
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">Подтверждение OTP</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  OTP отправлен на: {otpSentTo ?? formData.email}. Submission ID: {submissionId}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="otpCode" className="text-xs uppercase tracking-wider text-muted-foreground">
                    OTP код
                  </Label>
                  <Input
                    id="otpCode"
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value)}
                    className="h-12 bg-card border-border"
                    placeholder="6 цифр"
                    maxLength={6}
                  />
                </div>
                <Button type="button" onClick={() => void handleVerifyOtp()} disabled={isVerifyingOtp || !otpCode.trim()}>
                  {isVerifyingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Подтвердить OTP и завершить"}
                </Button>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="outline" asChild>
                <Link href="/issuer">Отмена</Link>
              </Button>
              {!submissionId && (
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !formData.patentNumber.trim() ||
                    !formData.patentTitle.trim() ||
                    !formData.claimedOwnerName.trim() ||
                    !formData.email.trim() ||
                    !formData.phone.trim()
                  }
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Отправить заявку и получить OTP"}
                </Button>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
