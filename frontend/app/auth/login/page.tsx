"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Eye, EyeOff, ExternalLink, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { IPChainLogo } from "@/components/ipchain-logo"
import { ApiError, authApi, getDefaultRouteForRole } from "@/lib/api"
import { useSession } from "@/components/providers/session-provider"
import { useWallet } from "@/components/providers/wallet-provider"
import { formatWalletAddress, signPhantomMessage } from "@/lib/phantom"

export default function LoginPage() {
  const router = useRouter()
  const { status, user, login, loginWithWallet } = useSession()
  const { providerStatus, connectedAddress, connect, isConnecting } = useWallet()

  const [isLoading, setIsLoading] = useState(false)
  const [isWalletLoading, setIsWalletLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })

  const isWalletDisabled = isLoading || isWalletLoading || isConnecting || providerStatus === "checking"

  const getWalletLoginError = (caughtError: unknown) => {
    if (caughtError instanceof ApiError) {
      if (caughtError.status === 404) {
        return "Этот Phantom кошелек еще не привязан к аккаунту. Зарегистрируйтесь как investor или привяжите wallet в профиле."
      }

      return caughtError.message
    }

    if (caughtError instanceof Error) {
      return caughtError.message
    }

    return "Не удалось выполнить вход через Phantom."
  }

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(getDefaultRouteForRole(user.role))
    }
  }, [router, status, user])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const currentUser = await login(formData)
      router.replace(getDefaultRouteForRole(currentUser.role))
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message)
      } else if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError("Не удалось выполнить вход.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleWalletLogin = async () => {
    setError(null)
    setIsWalletLoading(true)

    try {
      const walletAddress = connectedAddress ?? await connect()
      if (!walletAddress) {
        throw new Error("Не удалось получить адрес Phantom кошелька.")
      }

      const challenge = await authApi.createWalletLoginChallenge({
        wallet_address: walletAddress,
        network: "solana-devnet",
      })
      const signedMessage = await signPhantomMessage(challenge.message)
      if (signedMessage.walletAddress !== walletAddress) {
        throw new Error("Phantom подписал challenge другим кошельком. Переключите аккаунт и попробуйте снова.")
      }

      const currentUser = await loginWithWallet({
        wallet_address: walletAddress,
        network: challenge.network,
        message: challenge.message,
        signature: signedMessage.signature,
        challenge_token: challenge.challenge_token,
      })
      router.replace(getDefaultRouteForRole(currentUser.role))
    } catch (caughtError) {
      setError(getWalletLoginError(caughtError))
    } finally {
      setIsWalletLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <IPChainLogo size="lg" showText />
        </div>

        <div className="bg-card/50 border border-border rounded-2xl p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Войти в аккаунт</h1>
            <p className="text-muted-foreground text-sm">
              Авторизация через реальный backend API
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                className="h-12 bg-card border-border focus:border-primary focus:ring-primary/20"
                placeholder="email@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Пароль
                </Label>
                <Link href="/auth/register" className="text-xs text-primary hover:underline">
                  Нет аккаунта?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(event) => setFormData((current) => ({ ...current, password: event.target.value }))}
                  className="h-12 bg-card border-border focus:border-primary focus:ring-primary/20 pr-12"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || isWalletLoading}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm uppercase tracking-wider"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Войти"}
            </Button>

            <div className="relative py-1">
              <div className="border-t border-border" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                или
              </span>
            </div>

            <div className="rounded-xl border border-border bg-background/40 p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Phantom Wallet</p>
                  <p className="text-xs text-muted-foreground">
                    Вход доступен для кошелька, который уже привязан к вашему аккаунту investor.
                  </p>
                </div>
                {providerStatus === "unsupported" && (
                  <a
                    href="https://phantom.app/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Установить Phantom
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={isWalletDisabled || providerStatus === "unsupported"}
                onClick={() => {
                  void handleWalletLogin()
                }}
                className="w-full h-12 border-primary/40 bg-card text-foreground hover:border-primary hover:bg-primary/10"
              >
                {isWalletLoading || isConnecting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : providerStatus === "checking" ? (
                  "Проверяем Phantom..."
                ) : (
                  <>
                    <Wallet className="mr-2 h-5 w-5" />
                    Войти через Phantom
                  </>
                )}
              </Button>

              <div className="rounded-lg border border-border/70 bg-card/40 px-3 py-2 text-xs text-muted-foreground">
                <div>
                  Provider:{" "}
                  {providerStatus === "ready"
                    ? "Phantom detected"
                    : providerStatus === "checking"
                      ? "Checking..."
                      : "Phantom not found"}
                </div>
                <div>Connected wallet: {formatWalletAddress(connectedAddress)}</div>
                <div>Cluster: Solana Devnet</div>
              </div>
            </div>
          </form>

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
