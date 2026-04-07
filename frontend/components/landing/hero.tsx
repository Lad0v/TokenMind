import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Shield, ArrowRight } from "lucide-react"

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-20 sm:pt-32 sm:pb-28">
      {/* Background gradient effects */}
      <div className="absolute inset-0 verimint-gradient-top" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] verimint-gradient rounded-full blur-3xl opacity-50" />
      
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Shield Icon with Glow */}
          <div className="relative mb-8">
            <div className="absolute inset-0 verimint-glow rounded-full" />
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/10 sm:h-40 sm:w-40">
              <Shield className="h-16 w-16 text-primary sm:h-20 sm:w-20" />
            </div>
          </div>

          {/* Heading */}
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl text-balance">
            Токенизируйте ваши{" "}
            <span className="text-primary verimint-text-glow">IP-активы</span>
            {" "}на Solana
          </h1>

          {/* Description */}
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl text-pretty">
            Веб-платформа для верификации правообладателей, токенизации IP-активов 
            и их размещения на маркетплейсе с расчётами в Solana.
          </p>

          {/* Feature Tags */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Badge variant="outline" className="border-primary/50 bg-primary/10 px-4 py-1.5 text-primary">
              ВЕРИФИКАЦИЯ
            </Badge>
            <Badge variant="outline" className="border-primary/50 bg-primary/10 px-4 py-1.5 text-primary">
              ТОКЕНИЗАЦИЯ
            </Badge>
            <Badge variant="outline" className="border-primary/50 bg-primary/10 px-4 py-1.5 text-primary">
              МАРКЕТПЛЕЙС
            </Badge>
            <Badge variant="outline" className="border-primary/50 bg-primary/10 px-4 py-1.5 text-primary">
              SOLANA
            </Badge>
          </div>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Button size="lg" className="h-12 px-8 text-base font-medium" asChild>
              <Link href="/auth/register">
                Начать токенизацию
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base font-medium" asChild>
              <Link href="/marketplace">
                Исследовать маркетплейс
              </Link>
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="mt-16 flex flex-col items-center gap-4 text-sm text-muted-foreground">
            <p>Построено на блокчейне Solana</p>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span>Быстрые транзакции</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span>Низкие комиссии</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span>Безопасность</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
