"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { IPChainLogo } from "@/components/ipchain-logo"
import { Loader2, Wallet, AlertCircle, CheckCircle } from "lucide-react"
import { useWallet } from "@/hooks/use-wallet"
import { useRegister } from "@/hooks/use-api"
import { useAuth } from "@/lib/auth-context"
import { getUserFriendlyErrorMessage } from "@/lib/error-handler"

export default function RegisterPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const { walletAddress, isLoading: walletLoading, isAvailable, error: walletError, connect } = useWallet()
  const { execute: register, loading: registerLoading, error: registerError } = useRegister()

  const [formData, setFormData] = useState({
    email: "",
    legalName: "",
  })

  const [registrationSuccess, setRegistrationSuccess] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/marketplace')
    }
  }, [isAuthenticated, router])

  const handleWalletConnect = async () => {
    try {
      await connect()
    } catch (err) {
      console.error('Failed to connect wallet:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!walletAddress) {
      return
    }

    if (!formData.email) {
      alert('Пожалуйста, введите email')
      return
    }

    try {
      await register({
        email: formData.email,
        solana_wallet_address: walletAddress,
        legal_name: formData.legalName || undefined,
      })

      setRegistrationSuccess(true)

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/auth/login')
      }, 2000)
    } catch (err) {
      console.error('Registration failed:', err)
    }
  }

  const isLoading = walletLoading || registerLoading
  const error = walletError || registerError
  const errorMessage = error ? getUserFriendlyErrorMessage(error) : null

  if (registrationSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-card/50 border border-border rounded-2xl p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-2">Регистрация успешна!</h2>
            <p className="text-muted-foreground mb-6">
              Ваш аккаунт создан. Перенаправление на страницу входа...
            </p>

            <Link href="/auth/login">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                Перейти на страницу входа
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
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
              Присоединяйтесь к платформе IPChain
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-lg border border-destructive/30 bg-destructive/5 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          )}

          {/* Wallet Not Available Warning */}
          {!isAvailable && (
            <div className="mb-6 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-600">
                <p className="font-medium mb-1">Phantom wallet не найден</p>
                <p className="text-xs text-yellow-600/80">
                  Пожалуйста,{" "}
                  <a
                    href="https://phantom.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-yellow-700"
                  >
                    установите Phantom
                  </a>
                </p>
              </div>
            </div>
          )}

          {!walletAddress ? (
            <Button
              onClick={handleWalletConnect}
              disabled={isLoading || !isAvailable}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm uppercase tracking-wider flex items-center justify-center gap-2 mb-6"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Wallet className="h-5 w-5" />
              )}
              {isLoading ? "Подключение..." : "Подключить кошелек"}
            </Button>
          ) : (
            <>
              <div className="p-4 rounded-lg border border-border bg-card mb-6">
                <p className="text-xs text-muted-foreground mb-2">Подключённый кошелек:</p>
                <p className="text-sm font-mono text-foreground break-all">{walletAddress}</p>
                <Button
                  onClick={handleWalletConnect}
                  variant="ghost"
                  size="sm"
                  className="mt-3 h-8 text-xs"
                  disabled={isLoading}
                >
                  Изменить кошелек
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-12 bg-card border-border focus:border-primary focus:ring-primary/20"
                    placeholder="your@email.com"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="legalName" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Полное имя / Название организации
                  </Label>
                  <Input
                    id="legalName"
                    type="text"
                    value={formData.legalName}
                    onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                    className="h-12 bg-card border-border focus:border-primary focus:ring-primary/20"
                    placeholder="Иван Иванов или ООО Компания"
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !formData.email}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm uppercase tracking-wider"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Зарегистрироваться"
                  )}
                </Button>
              </form>
            </>
          )}

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
