"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { IPChainLogo } from "@/components/ipchain-logo"
import { 
  Shield, 
  CheckCircle2, 
  ArrowRight,
  User,
  FileText,
  Camera,
  Clock,
  Lock,
  AlertCircle
} from "lucide-react"

const steps = [
  {
    icon: User,
    title: "Личные данные",
    description: "Заполните информацию о себе"
  },
  {
    icon: FileText,
    title: "Документы",
    description: "Загрузите удостоверение личности"
  },
  {
    icon: Camera,
    title: "Селфи",
    description: "Сделайте фото для верификации"
  }
]

const benefits = [
  "Доступ к покупке токенов на маркетплейсе",
  "Возможность токенизации собственных IP-активов",
  "Вывод средств на банковский счёт",
  "Участие в аукционах"
]

export default function KYCStartPage() {
  const [isLoading, setIsLoading] = useState(false)

  const handleStart = async () => {
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    // Redirect to KYC provider or next step
    setIsLoading(false)
  }

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
          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 glow-emerald-sm">
              <Shield className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-4">
              KYC Верификация
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Для полного доступа к функциям платформы необходимо пройти 
              процедуру верификации личности
            </p>
          </div>

          {/* Why KYC */}
          <div className="p-6 rounded-xl border border-border bg-card/50 mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Зачем нужна верификация?
            </h2>
            <ul className="space-y-3">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Process Steps */}
          <div className="p-6 rounded-xl border border-border bg-card/50 mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-6">
              Процесс верификации
            </h2>
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={step.title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/30">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 pb-4 border-b border-border last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-foreground">{step.title}</h3>
                      <span className="text-xs text-muted-foreground">Шаг {index + 1}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Time Estimate */}
          <div className="flex items-center justify-center gap-6 mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Занимает ~5 минут</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>Данные защищены</span>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Button
              onClick={handleStart}
              disabled={isLoading}
              size="lg"
              className="h-14 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              {isLoading ? (
                "Загрузка..."
              ) : (
                <>
                  Начать верификацию
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
            
            <p className="mt-4 text-xs text-muted-foreground">
              Нажимая кнопку, вы соглашаетесь с{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                политикой обработки данных
              </Link>
            </p>
          </div>

          {/* Info Notice */}
          <div className="mt-8 p-4 rounded-lg bg-primary/10 border border-primary/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Подготовьте документы
                </p>
                <p className="text-xs text-muted-foreground">
                  Для прохождения верификации вам понадобится паспорт или другой 
                  документ, удостоверяющий личность, а также возможность сделать 
                  фотографию (селфи).
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
