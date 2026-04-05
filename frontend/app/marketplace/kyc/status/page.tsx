"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { IPChainLogo } from "@/components/ipchain-logo"
import { 
  Shield, 
  CheckCircle2, 
  Clock,
  AlertCircle,
  XCircle,
  RefreshCw,
  ArrowRight,
  FileText,
  User,
  Camera
} from "lucide-react"

type KYCStatus = "not_started" | "pending" | "needs_input" | "manual_review" | "approved" | "rejected" | "expired"

const statusConfig: Record<KYCStatus, {
  icon: typeof CheckCircle2
  color: string
  bgColor: string
  borderColor: string
  title: string
  description: string
}> = {
  not_started: {
    icon: AlertCircle,
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-border",
    title: "Верификация не начата",
    description: "Начните процесс KYC для получения полного доступа к платформе"
  },
  pending: {
    icon: Clock,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    title: "На рассмотрении",
    description: "Ваши документы проверяются. Обычно это занимает до 24 часов"
  },
  needs_input: {
    icon: AlertCircle,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    title: "Требуется дополнительная информация",
    description: "Пожалуйста, предоставьте недостающие документы или исправьте данные"
  },
  manual_review: {
    icon: Shield,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    title: "Ручная проверка",
    description: "Ваша заявка передана на ручную проверку администратору"
  },
  approved: {
    icon: CheckCircle2,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
    title: "Верификация пройдена",
    description: "Поздравляем! Вы получили полный доступ к функциям платформы"
  },
  rejected: {
    icon: XCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/30",
    title: "Верификация отклонена",
    description: "К сожалению, ваша заявка была отклонена. Вы можете подать новую заявку"
  },
  expired: {
    icon: Clock,
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-border",
    title: "Срок действия истёк",
    description: "Необходимо пройти повторную верификацию"
  }
}

const timelineSteps = [
  { id: 1, title: "Заявка подана", icon: FileText, completed: true, date: "01.04.2026, 14:30" },
  { id: 2, title: "Документы загружены", icon: User, completed: true, date: "01.04.2026, 14:35" },
  { id: 3, title: "Селфи верификация", icon: Camera, completed: true, date: "01.04.2026, 14:37" },
  { id: 4, title: "Проверка администратором", icon: Shield, completed: false, date: "Ожидание" }
]

export default function KYCStatusPage() {
  const [status, setStatus] = useState<KYCStatus>("pending")
  const [isRefreshing, setIsRefreshing] = useState(false)

  const config = statusConfig[status]
  const StatusIcon = config.icon

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setIsRefreshing(false)
  }

  // Simulate status polling
  useEffect(() => {
    const interval = setInterval(() => {
      // In real app: fetch status from API
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/">
              <IPChainLogo size="sm" />
            </Link>
            
            <nav className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Личный кабинет</span>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 lg:px-8 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Status Header */}
          <div className={`p-8 rounded-xl border ${config.borderColor} ${config.bgColor} mb-8`}>
            <div className="flex flex-col items-center text-center">
              <div className={`w-20 h-20 rounded-full ${config.bgColor} flex items-center justify-center mb-6 border ${config.borderColor}`}>
                <StatusIcon className={`h-10 w-10 ${config.color}`} />
              </div>
              
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={`${config.borderColor} ${config.color}`}>
                  KYC Статус
                </Badge>
              </div>
              
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {config.title}
              </h1>
              <p className="text-muted-foreground max-w-md">
                {config.description}
              </p>

              {(status === "pending" || status === "manual_review") && (
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="mt-6 border-border"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                  Обновить статус
                </Button>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="p-6 rounded-xl border border-border bg-card/50 mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-6">
              История верификации
            </h2>
            
            <div className="space-y-4">
              {timelineSteps.map((step, index) => (
                <div key={step.id} className="flex items-start gap-4">
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      step.completed 
                        ? "bg-primary/10 border border-primary/30" 
                        : "bg-muted border border-border"
                    }`}>
                      <step.icon className={`h-5 w-5 ${step.completed ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    {index < timelineSteps.length - 1 && (
                      <div className={`absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-8 ${
                        step.completed ? "bg-primary/30" : "bg-border"
                      }`} />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-medium ${step.completed ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.title}
                      </h3>
                      {step.completed && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{step.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions based on status */}
          {status === "approved" && (
            <div className="text-center">
              <Button size="lg" asChild className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/issuer">
                  Перейти в кабинет
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          )}

          {status === "rejected" && (
            <div className="text-center">
              <Button size="lg" asChild className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/kyc">
                  Подать новую заявку
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          )}

          {status === "needs_input" && (
            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    Требуется действие
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Качество загруженного документа недостаточно. 
                    Пожалуйста, загрузите более чёткую копию паспорта.
                  </p>
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Загрузить документ
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Demo Status Switcher (remove in production) */}
          <div className="mt-12 p-4 rounded-lg border border-border bg-card/30">
            <p className="text-xs text-muted-foreground mb-3">Demo: Переключить статус</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(statusConfig) as KYCStatus[]).map((s) => (
                <Button
                  key={s}
                  variant={status === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatus(s)}
                  className={status === s ? "bg-primary text-primary-foreground" : ""}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
