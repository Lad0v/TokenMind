import { Shield, Lock, Eye, Server } from "lucide-react"

const securityFeatures = [
  {
    icon: Shield,
    title: "Блокчейн Solana",
    description: "Все транзакции записываются в неизменяемый блокчейн Solana"
  },
  {
    icon: Lock,
    title: "Шифрование данных",
    description: "End-to-end шифрование всех пользовательских данных"
  },
  {
    icon: Eye,
    title: "KYC/AML проверка",
    description: "Строгая верификация для предотвращения мошенничества"
  },
  {
    icon: Server,
    title: "Аудит смарт-контрактов",
    description: "Все контракты проходят независимую проверку безопасности"
  }
]

export function Security() {
  return (
    <section id="security" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* Content */}
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Безопасность на{" "}
              <span className="text-primary">первом месте</span>
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Мы используем передовые технологии безопасности для защиты ваших 
              IP-активов и персональных данных на каждом этапе.
            </p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {securityFeatures.map((feature, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 verimint-gradient rounded-full blur-3xl opacity-30" />
            <div className="relative flex h-64 w-64 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/5 sm:h-80 sm:w-80">
              <div className="flex h-48 w-48 items-center justify-center rounded-full border border-primary/30 bg-primary/10 sm:h-60 sm:w-60">
                <div className="verimint-glow flex h-32 w-32 items-center justify-center rounded-full border-2 border-primary bg-primary/20 sm:h-40 sm:w-40">
                  <Shield className="h-16 w-16 text-primary sm:h-20 sm:w-20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
