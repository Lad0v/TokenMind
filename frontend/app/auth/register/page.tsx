"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { IPChainLogo } from "@/components/ipchain-logo"
import { Loader2, Wallet } from "lucide-react"

import { useAuth } from "@/hooks/use-auth"
import { shortenAddress } from "@/lib/format"

export default function RegisterPage() {
  const router = useRouter()
  const { walletAddress, connectWallet, registerInvestor, isAuthenticating } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    country: "",
    acceptTerms: false
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await registerInvestor({
        email: formData.email,
        legal_name: formData.fullName || undefined,
        country: formData.country || undefined,
      })
      router.push("/marketplace")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Регистрация не удалась")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <IPChainLogo size="lg" showText />
        </div>
        
        <div className="bg-card/50 border border-border rounded-2xl p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Создать аккаунт</h1>
            <p className="text-muted-foreground text-sm">
              Регистрация инвестора требует email и привязанный Solana-кошелёк
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-xs uppercase tracking-wider text-muted-foreground">
                Полное имя
              </Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="h-12 bg-card border-border focus:border-primary focus:ring-primary/20"
                placeholder="Иван Иванов"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-12 bg-card border-border focus:border-primary focus:ring-primary/20"
                placeholder="email@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country" className="text-xs uppercase tracking-wider text-muted-foreground">
                Страна
              </Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value.toUpperCase() })}
                className="h-12 bg-card border-border focus:border-primary focus:ring-primary/20"
                placeholder="US"
                maxLength={3}
              />
            </div>

            <div className="rounded-xl border border-border bg-background/40 p-4 text-sm">
              <p className="text-muted-foreground mb-2">Кошелёк для входа и покупок</p>
              <p className="font-medium text-foreground">{walletAddress ? shortenAddress(walletAddress) : "Не подключен"}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void connectWallet()}
                disabled={isAuthenticating}
                className="mt-4 w-full h-11 border-border hover:border-primary/50 hover:bg-card/50 transition-all"
              >
                <Wallet className="h-5 w-5 mr-3" />
                {walletAddress ? "Переподключить Phantom" : "Подключить Phantom"}
              </Button>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={formData.acceptTerms}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, acceptTerms: checked as boolean })
                }
                className="mt-1 border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                Регистрируясь, вы подтверждаете согласие с правилами платформы и можете сразу перейти в{" "}
                <Link href="/marketplace" className="text-primary hover:underline">
                  маркетплейс
                </Link>{" "}
                или{" "}
                <Link href="/auth/login" className="text-primary hover:underline">
                  войти в аккаунт
                </Link>
              </Label>
            </div>

            <Button
              type="submit"
              disabled={isAuthenticating || !formData.acceptTerms || !walletAddress}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm uppercase tracking-wider"
            >
              {isAuthenticating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Зарегистрироваться"
              )}
            </Button>

            {error && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Уже есть аккаунт?{" "}
            <Link href="/auth/login" className="text-primary hover:underline font-medium">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
