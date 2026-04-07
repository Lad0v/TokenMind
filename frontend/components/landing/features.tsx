import { Card, CardContent } from "@/components/ui/card"
import { 
  ShieldCheck, 
  Coins, 
  Store, 
  Wallet,
  FileCheck,
  Globe
} from "lucide-react"

const features = [
  {
    icon: ShieldCheck,
    title: "KYC Верификация",
    description: "Полная проверка личности и прав на интеллектуальную собственность для обеспечения безопасности транзакций."
  },
  {
    icon: FileCheck,
    title: "IP Регистрация",
    description: "Зарегистрируйте ваши патенты, товарные знаки и авторские права на блокчейне с юридической силой."
  },
  {
    icon: Coins,
    title: "Токенизация активов",
    description: "Преобразуйте ваши IP-активы в токены Solana для удобной торговли и дробления прав."
  },
  {
    icon: Store,
    title: "Маркетплейс",
    description: "Размещайте и продавайте токенизированные IP-активы на децентрализованном маркетплейсе."
  },
  {
    icon: Wallet,
    title: "Solana кошелёк",
    description: "Интегрированная поддержка Solana-кошельков для мгновенных и безопасных транзакций."
  },
  {
    icon: Globe,
    title: "Глобальный доступ",
    description: "Получите доступ к глобальному рынку инвесторов и покупателей интеллектуальной собственности."
  }
]

export function Features() {
  return (
    <section id="features" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Полный набор инструментов для{" "}
            <span className="text-primary">IP-токенизации</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            От верификации до продажи — все этапы работы с интеллектуальной собственностью на одной платформе.
          </p>
        </div>

        {/* Features Grid */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="group border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:bg-card"
            >
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
