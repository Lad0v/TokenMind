import Link from "next/link"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, FileText, Cpu, Lightbulb } from "lucide-react"

const listings = [
  {
    icon: FileText,
    type: "Патент",
    title: "Алгоритм машинного обучения",
    description: "Запатентованный алгоритм для обработки больших данных",
    price: "150 SOL",
    status: "Активный"
  },
  {
    icon: Cpu,
    type: "Технология",
    title: "IoT Сенсорная система",
    description: "Инновационная система мониторинга для умных городов",
    price: "320 SOL",
    status: "Активный"
  },
  {
    icon: Lightbulb,
    type: "Изобретение",
    title: "Энергосберегающий модуль",
    description: "Устройство для оптимизации энергопотребления",
    price: "85 SOL",
    status: "Активный"
  }
]

export function Marketplace() {
  return (
    <section className="relative py-20 sm:py-28 bg-secondary/30" id = "marketplace">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Маркетплейс IP-активов
            </h2>
            <p className="mt-2 text-lg text-muted-foreground">
              Исследуйте и инвестируйте в токенизированную интеллектуальную собственность
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/marketplace">
              Все листинги
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Listings Grid */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing, index) => (
            <Card 
              key={index} 
              className="group border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:bg-card"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <listing.icon className="h-6 w-6 text-primary" />
                  </div>
                  <Badge variant="outline" className="border-primary/50 text-primary">
                    {listing.status}
                  </Badge>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {listing.type}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-foreground">{listing.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {listing.description}
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between border-t border-border/50 p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Цена</p>
                  <p className="text-lg font-semibold text-primary">{listing.price}</p>
                </div>
                <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10">
                  Подробнее
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
