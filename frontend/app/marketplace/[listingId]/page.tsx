"use client"

import { use } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { IPChainLogo } from "@/components/ipchain-logo"
import {Header} from "@/components/user/header"
import { 
  ArrowLeft, 
  ExternalLink, 
  Shield, 
  FileText, 
  User,
  Calendar,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Copy,
  TrendingUp
} from "lucide-react"

// Mock data - in real app this would come from API
const getMockListing = (id: string) => ({
  id,
  patentNumber: "RU2789456",
  title: "Способ обработки данных в распределённой системе",
  description: "Изобретение относится к области обработки данных и может быть использовано для повышения эффективности распределённых вычислительных систем. Предложенный способ позволяет оптимизировать распределение нагрузки между узлами системы и уменьшить время обработки запросов.",
  issuer: "ООО «ТехноИнновации»",
  issuerVerified: true,
  status: "active",
  priceModel: "fixed",
  price: "150",
  currency: "SOL",
  availableTokens: 850,
  totalTokens: 1000,
  category: "Информационные технологии",
  jurisdiction: "Российская Федерация",
  filingDate: "2024-03-15",
  mintAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  network: "Solana Mainnet",
  documents: [
    { name: "Патентная грамота", type: "PDF" },
    { name: "Техническое описание", type: "PDF" },
    { name: "Экспертное заключение", type: "PDF" }
  ]
})

export default function ListingDetailPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = use(params)
  const listing = getMockListing(listingId)

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <Header/>

      <main className="container mx-auto px-4 lg:px-8 py-8">
        {/* Back link */}
        <Link 
          href="/marketplace" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к маркетплейсу
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="p-6 rounded-xl border border-border bg-card/50">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
                    Активен
                  </Badge>
                  <Badge variant="secondary">{listing.category}</Badge>
                </div>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Solscan
                </Button>
              </div>

              <p className="text-sm text-muted-foreground mb-2">{listing.patentNumber}</p>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-4">
                {listing.title}
              </h1>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{listing.issuer}</span>
                  {listing.issuerVerified && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{listing.filingDate}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="p-6 rounded-xl border border-border bg-card/50">
              <h2 className="text-lg font-semibold text-foreground mb-4">Описание</h2>
              <p className="text-muted-foreground leading-relaxed">{listing.description}</p>
            </div>

            {/* Technical Details */}
            <div className="p-6 rounded-xl border border-border bg-card/50">
              <h2 className="text-lg font-semibold text-foreground mb-4">Технические данные</h2>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-secondary/30">
                  <p className="text-xs text-muted-foreground mb-1">Mint Address</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm text-foreground font-mono truncate">
                      {listing.mintAddress}
                    </code>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-4 rounded-lg bg-secondary/30">
                  <p className="text-xs text-muted-foreground mb-1">Сеть</p>
                  <p className="text-sm text-foreground">{listing.network}</p>
                </div>
                
                <div className="p-4 rounded-lg bg-secondary/30">
                  <p className="text-xs text-muted-foreground mb-1">Юрисдикция</p>
                  <p className="text-sm text-foreground">{listing.jurisdiction}</p>
                </div>
                
                <div className="p-4 rounded-lg bg-secondary/30">
                  <p className="text-xs text-muted-foreground mb-1">Всего токенов</p>
                  <p className="text-sm text-foreground">{listing.totalTokens.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Documents */}
            <div className="p-6 rounded-xl border border-border bg-card/50">
              <h2 className="text-lg font-semibold text-foreground mb-4">Документы</h2>
              
              <div className="space-y-3">
                {listing.documents.map((doc) => (
                  <div 
                    key={doc.name}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.type}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar - Buy Panel */}
          <div className="space-y-6">
            {/* Price Card */}
            <div className="p-6 rounded-xl border border-primary/30 bg-card/50 sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">Цена за токен</p>
                  <p className="text-3xl font-bold text-primary">
                    {listing.price} <span className="text-lg">{listing.currency}</span>
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
              </div>

              {/* Availability */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Доступно</span>
                  <span className="text-foreground font-medium">
                    {listing.availableTokens.toLocaleString()} / {listing.totalTokens.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${(listing.availableTokens / listing.totalTokens) * 100}%` }}
                  />
                </div>
              </div>

              {/* Buy Form - Disabled for guests */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Количество токенов
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    placeholder="100"
                    className="h-12 bg-card border-border"
                    disabled
                  />
                </div>

                <div className="p-4 rounded-lg bg-secondary/30">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Итого:</span>
                    <span className="text-lg font-semibold text-foreground">— SOL</span>
                  </div>
                </div>

                {/* Auth Required Notice */}
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                  <div className="flex items-start gap-3">
                    <Wallet className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        Требуется авторизация
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Для покупки токенов войдите в аккаунт и пройдите KYC верификацию
                      </p>
                    </div>
                  </div>
                </div>

                <Button 
                  asChild
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                >
                  <Link href="/auth/login">
                    Войти для покупки
                  </Link>
                </Button>

                <Button 
                  variant="outline" 
                  asChild
                  className="w-full h-12 border-border hover:border-primary/50"
                >
                  <Link href="/auth/register">
                    <Wallet className="mr-2 h-5 w-5" />
                    Подключить кошелёк
                  </Link>
                </Button>
              </div>

              {/* Risk Disclaimer */}
              <div className="mt-6 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">
                      Предупреждение о рисках
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Инвестиции в токенизированные активы сопряжены с рисками. 
                      Внимательно изучите документацию перед покупкой.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50 mt-12">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <IPChainLogo size="sm" />
            <p className="text-sm text-muted-foreground">
              © 2026 IPChain. Все права защищены.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
