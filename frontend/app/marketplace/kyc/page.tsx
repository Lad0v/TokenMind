"use client"

import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"
import { ArrowRight, FileText, Loader2, Shield, User, Camera } from "lucide-react"

import { Header } from "@/components/user/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSession } from "@/components/providers/session-provider"
import { ApiError, userApi } from "@/lib/api"

const steps = [
  {
    icon: User,
    title: "Личные данные",
    description: "Укажите адрес проживания и проверьте, что аккаунт оформлен на реальные данные.",
  },
  {
    icon: FileText,
    title: "Документ",
    description: "Загрузите паспорт или другой ID в читаемом качестве.",
  },
  {
    icon: Camera,
    title: "Селфи",
    description: "Добавьте selfie для ручной сверки администратором.",
  },
]

function statusCopy(status: string) {
  switch (status) {
    case "approved":
      return { title: "KYS одобрен", description: "Покупки на маркетплейсе разблокированы." }
    case "pending":
      return { title: "KYS на рассмотрении", description: "Документы уже отправлены, ожидайте review." }
    case "rejected":
      return { title: "KYS отклонен", description: "Исправьте документы и отправьте пакет заново." }
    default:
      return { title: "KYS не начат", description: "Без верификации покупки токенов будут заблокированы." }
  }
}

export default function MarketplaceKysPage() {
  const { status } = useSession()
  const [verificationStatus, setVerificationStatus] = useState<string>("not_started")
  const [userAddress, setUserAddress] = useState("")
  const [idDocument, setIdDocument] = useState<File | null>(null)
  const [selfie, setSelfie] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (status !== "authenticated") {
      setVerificationStatus("not_started")
      return
    }

    let cancelled = false
    setIsLoading(true)

    void userApi
      .getVerificationStatus()
      .then((payload) => {
        if (!cancelled) {
          setVerificationStatus(payload.status)
          setUserAddress(payload.user_address ?? "")
        }
      })
      .catch((caughtError) => {
        if (cancelled) {
          return
        }
        if (caughtError instanceof ApiError && caughtError.status === 404) {
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

  const copy = statusCopy(verificationStatus)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!idDocument || !selfie) {
      setError("Нужно загрузить и документ, и selfie.")
      return
    }
    if (!userAddress.trim()) {
      setError("Укажите адрес проживания.")
      return
    }

    const formData = new FormData()
    formData.set("id_document", idDocument)
    formData.set("selfie", selfie)
    formData.set("user_address", userAddress.trim())

    setIsSubmitting(true)
    try {
      const payload = await userApi.submitVerificationDocuments(formData)
      setVerificationStatus(payload.status)
      setMessage("Документы отправлены. Статус переведен в pending.")
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message)
      } else if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError("Не удалось отправить документы.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 lg:px-8 py-12 mt-20">
          <Card className="mx-auto max-w-2xl">
            <CardHeader>
              <CardTitle>KYS доступен после входа</CardTitle>
              <CardDescription>Сначала войдите в investor-аккаунт, затем загрузите документы для покупки токенов.</CardDescription>
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
              <Shield className="h-10 w-10 text-primary" />
            </div>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              Universal KYS
            </Badge>
            <h1 className="mt-4 text-3xl font-bold text-foreground">Верификация перед покупкой токенов</h1>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Верификация доступна любому авторизованному пользователю: документ, selfie и адрес проживания уходят в backend review queue.
            </p>
          </section>

          {(error || message) && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                error ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-primary/30 bg-primary/10 text-primary"
              }`}
            >
              {error ?? message}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{copy.title}</span>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </CardTitle>
              <CardDescription>{copy.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/marketplace?tab=portfolio">Вернуться в маркетплейс</Link>
              </Button>
              <Button asChild>
                <Link href="/marketplace/kyc/status">
                  Смотреть статус
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Процесс KYS</CardTitle>
              <CardDescription>Документы идут в существующую admin verification queue, без отдельного внешнего провайдера.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {steps.map((step, index) => (
                <div key={step.title} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 border-b border-border pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-foreground">{step.title}</div>
                      <div className="text-xs text-muted-foreground">Шаг {index + 1}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">{step.description}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Отправка документов</CardTitle>
              <CardDescription>Если статус `rejected`, можно отправить пакет повторно. При `pending` или `approved` повторная отправка не нужна.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="userAddress">Адрес проживания</Label>
                  <Input
                    id="userAddress"
                    value={userAddress}
                    onChange={(event) => setUserAddress(event.target.value)}
                    className="h-12"
                    placeholder="Город, улица, дом"
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="idDocument">ID документ</Label>
                    <Input
                      id="idDocument"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(event) => setIdDocument(event.target.files?.[0] ?? null)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="selfie">Selfie</Label>
                    <Input
                      id="selfie"
                      type="file"
                      accept="image/*"
                      onChange={(event) => setSelfie(event.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || verificationStatus === "pending" || verificationStatus === "approved"}
                  className="h-12"
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Отправить на проверку"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
