"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { IPChainLogo } from "@/components/ipchain-logo"
import { 
  ArrowLeft, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Upload,
  FileText,
  Loader2,
  Shield,
  Info
} from "lucide-react"

type PreCheckStatus = "idle" | "checking" | "found" | "not_found" | "partial" | "api_error"

const preCheckConfig: Record<PreCheckStatus, { 
  icon: typeof CheckCircle2
  color: string
  bgColor: string
  borderColor: string
  title: string
  description: string
} | null> = {
  idle: null,
  checking: {
    icon: Loader2,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    title: "Проверка патента...",
    description: "Запрос к государственному реестру патентов"
  },
  found: {
    icon: CheckCircle2,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
    title: "Патент найден",
    description: "Данные успешно загружены из реестра"
  },
  not_found: {
    icon: XCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/30",
    title: "Патент не найден",
    description: "Проверьте номер патента и попробуйте снова"
  },
  partial: {
    icon: AlertCircle,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    title: "Частичное совпадение",
    description: "Некоторые данные требуют ручной проверки"
  },
  api_error: {
    icon: AlertCircle,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    title: "Сервис недоступен",
    description: "Не удалось связаться с реестром. Заполните данные вручную"
  }
}

export default function NewPatentClaimPage() {
  const [preCheckStatus, setPreCheckStatus] = useState<PreCheckStatus>("idle")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    patentNumber: "",
    patentTitle: "",
    claimedOwnerName: "",
    description: "",
    jurisdiction: "RU"
  })
  const [documents, setDocuments] = useState<File[]>([])

  const handlePreCheck = async () => {
    if (!formData.patentNumber) return
    
    setPreCheckStatus("checking")
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Simulate successful response
    setPreCheckStatus("found")
    setFormData(prev => ({
      ...prev,
      patentTitle: "Способ обработки данных в распределённой системе",
      claimedOwnerName: "ООО «ТехноИнновации»"
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    // Redirect to claim detail page
    setIsSubmitting(false)
  }

  const config = preCheckStatus !== "idle" ? preCheckConfig[preCheckStatus] : null

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/">
              <IPChainLogo size="sm" />
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 lg:px-8 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Back link */}
          <Link 
            href="/issuer" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад в кабинет
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Подача патента</h1>
            <p className="text-muted-foreground">
              Введите номер патента для автоматической проверки и заполнения данных
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Step 1: Patent Number & Pre-check */}
            <div className="p-6 rounded-xl border border-border bg-card/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  1
                </div>
                <h2 className="text-lg font-semibold text-foreground">Проверка патента</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="patentNumber" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Номер патента *
                  </Label>
                  <div className="flex gap-3">
                    <Input
                      id="patentNumber"
                      value={formData.patentNumber}
                      onChange={(e) => setFormData({ ...formData, patentNumber: e.target.value })}
                      placeholder="RU2789456"
                      className="h-12 bg-card border-border flex-1"
                    />
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
                  </div>
                </div>

                {/* Pre-check result */}
                {config && (
                  <div className={`p-4 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
                    <div className="flex items-start gap-3">
                      <config.icon className={`h-5 w-5 ${config.color} flex-shrink-0 mt-0.5 ${preCheckStatus === "checking" ? "animate-spin" : ""}`} />
                      <div>
                        <p className={`text-sm font-medium ${config.color}`}>{config.title}</p>
                        <p className="text-xs text-muted-foreground">{config.description}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Мы проверяем патент через интеграцию с государственным реестром. 
                    Финальное решение принимает администратор платформы.
                  </span>
                </div>
              </div>
            </div>

            {/* Step 2: Patent Details */}
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
                    onChange={(e) => setFormData({ ...formData, patentTitle: e.target.value })}
                    placeholder="Введите название или оно будет заполнено автоматически"
                    className="h-12 bg-card border-border"
                  />
                  {preCheckStatus === "found" && formData.patentTitle && (
                    <p className="text-xs text-primary flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Заполнено автоматически
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="claimedOwnerName" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Имя правообладателя *
                  </Label>
                  <Input
                    id="claimedOwnerName"
                    value={formData.claimedOwnerName}
                    onChange={(e) => setFormData({ ...formData, claimedOwnerName: e.target.value })}
                    placeholder="ООО «Компания» или ФИО"
                    className="h-12 bg-card border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Описание (опционально)
                  </Label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Краткое описание патента и его применения"
                    rows={4}
                    className="w-full px-4 py-3 rounded-md bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jurisdiction" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Юрисдикция
                  </Label>
                  <select
                    id="jurisdiction"
                    value={formData.jurisdiction}
                    onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
                    className="w-full h-12 px-4 rounded-md bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="RU">Российская Федерация</option>
                    <option value="US">США</option>
                    <option value="EU">Европейский Союз</option>
                    <option value="CN">Китай</option>
                    <option value="other">Другое</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 3: Documents */}
            <div className="p-6 rounded-xl border border-border bg-card/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  3
                </div>
                <h2 className="text-lg font-semibold text-foreground">Документы</h2>
              </div>

              <div className="space-y-4">
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        setDocuments(Array.from(e.target.files))
                      }
                    }}
                  />
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm text-foreground mb-1">
                    Нажмите для загрузки или перетащите файлы
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, DOC, DOCX, JPG, PNG до 10MB
                  </p>
                </div>

                {documents.length > 0 && (
                  <div className="space-y-2">
                    {documents.map((file, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary" />
                          <span className="text-sm text-foreground">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDocuments(documents.filter((_, i) => i !== index))}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Загрузите патентную грамоту и подтверждающие документы
                </p>
              </div>
            </div>

            {/* Submit Notice */}
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    Проверка администратором
                  </p>
                  <p className="text-xs text-muted-foreground">
                    После отправки заявка будет направлена на проверку администратору платформы. 
                    Решение об одобрении принимается в течение 1-3 рабочих дней.
                  </p>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" asChild className="border-border">
                <Link href="/issuer">Отмена</Link>
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.patentNumber || !formData.claimedOwnerName}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  "Отправить заявку"
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
