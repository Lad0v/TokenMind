import { Badge } from "@/components/ui/badge"

const steps = [
  {
    number: "01",
    title: "Регистрация и KYC",
    description: "Создайте аккаунт и пройдите верификацию личности для подтверждения вашей идентичности и прав на IP."
  },
  {
    number: "02",
    title: "Подача IP-заявки",
    description: "Загрузите документы на вашу интеллектуальную собственность: патенты, товарные знаки или авторские права."
  },
  {
    number: "03",
    title: "Экспертиза и одобрение",
    description: "Наши эксперты проверят подлинность документов и подтвердят ваши права на интеллектуальную собственность."
  },
  {
    number: "04",
    title: "Токенизация",
    description: "После одобрения ваш IP-актив будет токенизирован на блокчейне Solana с уникальным идентификатором."
  },
  {
    number: "05",
    title: "Листинг на маркетплейсе",
    description: "Разместите токенизированный актив на маркетплейсе для продажи или привлечения инвестиций."
  }
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-20 sm:py-28 bg-secondary/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4 border-primary/50 bg-primary/10 text-primary">
            Процесс
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Как это работает
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Простой и прозрачный процесс токенизации вашей интеллектуальной собственности
          </p>
        </div>

        {/* Steps */}
        <div className="mt-16 relative">
          {/* Vertical line for desktop */}
          <div className="absolute left-1/2 top-0 bottom-0 hidden w-px -translate-x-1/2 bg-border lg:block" />
          
          <div className="space-y-12 lg:space-y-16">
            {steps.map((step, index) => (
              <div 
                key={index} 
                className={`relative flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-12 ${
                  index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
                }`}
              >
                {/* Content */}
                <div className={`flex-1 ${index % 2 === 0 ? "lg:text-right" : "lg:text-left"}`}>
                  <div className={`rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm ${
                    index % 2 === 0 ? "lg:ml-auto lg:mr-0" : "lg:ml-0 lg:mr-auto"
                  } max-w-lg`}>
                    <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-2 text-muted-foreground">{step.description}</p>
                  </div>
                </div>

                {/* Number Badge */}
                <div className="absolute left-0 top-0 flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary bg-background text-lg font-bold text-primary lg:relative lg:left-auto lg:top-auto lg:flex-shrink-0">
                  {step.number}
                </div>

                {/* Spacer for alignment */}
                <div className="hidden flex-1 lg:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
