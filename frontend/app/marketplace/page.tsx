"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { IPChainLogo } from "@/components/ipchain-logo"
import {Header} from "@/components/user/header"
import { 
  Search, 
  Filter, 
  ArrowUpDown,
  ExternalLink,
  Wallet,
  TrendingUp,
  Clock,
  Shield
} from "lucide-react"

const mockListings = [
  {
    id: "1",
    patentNumber: "RU2789456",
    title: "Способ обработки данных в распределённой системе",
    issuer: "ООО «ТехноИнновации»",
    status: "active",
    priceModel: "fixed",
    price: "150 SOL",
    availableTokens: 850,
    totalTokens: 1000,
    category: "Информационные технологии"
  },
  {
    id: "2",
    patentNumber: "RU2785123",
    title: "Устройство для автоматизированного контроля качества",
    issuer: "АО «ПромТехника»",
    status: "active",
    priceModel: "auction",
    price: "от 75 SOL",
    availableTokens: 500,
    totalTokens: 500,
    category: "Промышленность"
  },
  {
    id: "3",
    patentNumber: "RU2791890",
    title: "Метод синтеза биоактивных соединений",
    issuer: "НИИ «БиоФарм»",
    status: "active",
    priceModel: "fixed",
    price: "300 SOL",
    availableTokens: 200,
    totalTokens: 400,
    category: "Фармацевтика"
  },
  {
    id: "4",
    patentNumber: "RU2788765",
    title: "Система умного дома с AI управлением",
    issuer: "SmartHome Labs",
    status: "active",
    priceModel: "fixed",
    price: "95 SOL",
    availableTokens: 1500,
    totalTokens: 2000,
    category: "IoT / Умный дом"
  },
  {
    id: "5",
    patentNumber: "RU2792345",
    title: "Алгоритм машинного обучения для прогнозирования",
    issuer: "AI Research Group",
    status: "active",
    priceModel: "auction",
    price: "от 200 SOL",
    availableTokens: 100,
    totalTokens: 100,
    category: "Искусственный интеллект"
  },
  {
    id: "6",
    patentNumber: "RU2786543",
    title: "Энергоэффективный солнечный коллектор",
    issuer: "GreenEnergy Corp",
    status: "active",
    priceModel: "fixed",
    price: "180 SOL",
    availableTokens: 750,
    totalTokens: 1000,
    category: "Энергетика"
  }
]

const categories = [
  "Все категории",
  "Информационные технологии",
  "Промышленность",
  "Фармацевтика",
  "IoT / Умный дом",
  "Искусственный интеллект",
  "Энергетика"
]

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("Все категории")

  const filteredListings = mockListings.filter(listing => {
    const matchesSearch = listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         listing.patentNumber.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "Все категории" || listing.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}

      <Header/>

      {/* Page Content */}
      <main className="container mx-auto px-4 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Маркетплейс</h1>
          <p className="text-muted-foreground">
            Публичный каталог токенизированных IP-активов
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию или номеру патента..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 bg-card border-border"
            />
          </div>
          
          <div className="flex gap-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-12 px-4 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            
            <Button variant="outline" className="h-12 px-4 border-border">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Сортировка
            </Button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Shield, label: "Активных листингов", value: mockListings.length.toString() },
            { icon: TrendingUp, label: "Объём за 24ч", value: "1,250 SOL" },
            { icon: Wallet, label: "Всего токенов", value: "5,400" },
            { icon: Clock, label: "Новых сегодня", value: "3" }
          ].map((stat) => (
            <div key={stat.label} className="p-4 rounded-lg border border-border bg-card/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-foreground">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Listings Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((listing) => (
            <Link
              key={listing.id}
              href={`/marketplace/${listing.id}`}
              className="group p-6 rounded-xl border border-border bg-card/50 hover:border-primary/50 hover:bg-card transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
                  {listing.status === "active" ? "Активен" : listing.status}
                </Badge>
                <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
                  {listing.priceModel === "fixed" ? "Фикс. цена" : "Аукцион"}
                </Badge>
              </div>

              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-1">{listing.patentNumber}</p>
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {listing.title}
                </h3>
              </div>

              <p className="text-sm text-muted-foreground mb-4">{listing.issuer}</p>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Цена</p>
                  <p className="text-lg font-semibold text-primary">{listing.price}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Доступно</p>
                  <p className="text-sm text-foreground">
                    {listing.availableTokens} / {listing.totalTokens}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(listing.availableTokens / listing.totalTokens) * 100}%` }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Empty State */}
        {filteredListings.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Ничего не найдено</h3>
            <p className="text-muted-foreground">
              Попробуйте изменить параметры поиска или фильтры
            </p>
          </div>
        )}

        {/* Login CTA */}
        <div className="mt-12 p-8 rounded-xl border border-primary/30 bg-card/50 text-center">
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Хотите инвестировать?
          </h3>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Для покупки токенов необходимо зарегистрироваться и пройти KYC верификацию
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/auth/register">Зарегистрироваться</Link>
            </Button>
            <Button variant="outline" asChild className="border-border hover:border-primary/50">
              <Link href="/auth/login">Войти в аккаунт</Link>
            </Button>
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
