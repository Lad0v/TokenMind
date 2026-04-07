import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Wallet } from "lucide-react"

export function CTA() {
  return (
    <section className="relative py-20 sm:py-28 bg-secondary/30">
      <div className="absolute inset-0 verimint-gradient-top opacity-50" />
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl text-balance">
          Готовы токенизировать вашу{" "}
          <span className="text-primary verimint-text-glow">интеллектуальную собственность</span>?
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Присоединяйтесь к растущему сообществу правообладателей и инвесторов на платформе IPChain.
          Начните токенизацию прямо сейчас.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" className="h-14 px-8 text-base font-medium" asChild>
            <Link href="/auth/register">
              Создать аккаунт
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-14 px-8 text-base font-medium" asChild>
            <Link href="/auth/register">
              <Wallet className="mr-2 h-5 w-5" />
              Подключить Phantom
            </Link>
          </Button>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Регистрируясь, вы принимаете{" "}
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            Условия использования
          </Link>
          {" "}и{" "}
          <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
            Политику конфиденциальности
          </Link>
        </p>
      </div>
    </section>
  )
}
