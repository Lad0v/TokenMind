const stats = [
  {
    value: "500+",
    label: "IP-активов токенизировано"
  },
  {
    value: "$2M+",
    label: "Объём торгов"
  },
  {
    value: "1000+",
    label: "Верифицированных пользователей"
  },
  {
    value: "< 1с",
    label: "Скорость транзакций"
  }
]

export function Stats() {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="absolute inset-0 verimint-gradient opacity-30" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl font-bold text-primary sm:text-5xl verimint-text-glow">
                {stat.value}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
