"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { IPChainLogo } from "@/components/ipchain-logo"
import { Loader2, Wallet } from "lucide-react"

import { useAuth } from "@/hooks/use-auth"
import { shortenAddress } from "@/lib/format"

export default function LoginPage() {
  const router = useRouter()
  const { walletAddress, connectWallet, loginWithWallet, isAuthenticating } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const handleWalletLogin = async () => {
    setError(null)
    try {
      const me = await loginWithWallet()
      if (me.role === "issuer") {
        router.push("/issuer")
        return
      }
      if (me.role === "admin") {
        router.push("/admin")
        return
      }
      router.push("/marketplace")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти с помощью кошелька")
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
            <h1 className="text-2xl font-bold text-foreground mb-2">Войти в аккаунт</h1>
            <p className="text-muted-foreground text-sm">
              Авторизация для платформы выполняется через привязанный Solana-кошелёк
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-background/40 p-4 text-sm">
              <p className="text-muted-foreground mb-2">Текущий кошелёк</p>
              <p className="font-medium text-foreground">{walletAddress ? shortenAddress(walletAddress) : "Не подключен"}</p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => void connectWallet()}
              disabled={isAuthenticating}
              className="w-full h-12 border-border hover:border-primary/50 hover:bg-card/50 transition-all"
            >
              <Wallet className="h-5 w-5 mr-3" />
              {walletAddress ? "Переподключить Phantom" : "Подключить Phantom"}
            </Button>

            <Button
              type="button"
              onClick={() => void handleWalletLogin()}
              disabled={isAuthenticating}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm uppercase tracking-wider"
            >
              {isAuthenticating ? <Loader2 className="h-5 w-5 animate-spin" /> : "Войти с кошельком"}
            </Button>

            {error && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Нет аккаунта?{" "}
            <Link href="/auth/register" className="text-primary hover:underline font-medium">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
