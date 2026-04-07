"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, ExternalLink, Loader2, Wallet } from "lucide-react"

import { useSession } from "@/components/providers/session-provider"
import { useWallet } from "@/components/providers/wallet-provider"
import { IPChainLogo } from "@/components/ipchain-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, getDefaultRouteForRole, type UserRole } from "@/lib/api"
import { formatWalletAddress } from "@/lib/phantom"

type RegistrationRole = Extract<UserRole, "user" | "issuer" | "investor">

const registrationRoleOptions: Array<{ value: RegistrationRole; label: string }> = [
  { value: "issuer", label: "Issuer" },
  { value: "user", label: "User" },
  { value: "investor", label: "Investor" },
]

export default function RegisterPage() {
  const router = useRouter()
  const { status, user, login, register } = useSession()
  const { providerStatus, connectedAddress, balanceSOL, connect, isConnecting } = useWallet()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    country: "US",
    role: "issuer" as RegistrationRole,
    walletAddress: "",
    acceptTerms: false,
  })

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(getDefaultRouteForRole(user.role))
    }
  }, [router, status, user])

  useEffect(() => {
    if (formData.role !== "investor" || !connectedAddress) {
      return
    }

    setFormData((current) =>
      current.walletAddress === connectedAddress
        ? current
        : {
            ...current,
            walletAddress: connectedAddress,
          },
    )
  }, [connectedAddress, formData.role])

  const handleConnectWallet = async () => {
    setError(null)

    try {
      const address = await connect()
      if (address) {
        setFormData((current) => ({ ...current, walletAddress: address }))
      }
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError("Не удалось подключить Phantom.")
      }
    }
  }

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (formData.role === "investor" && !formData.walletAddress.trim()) {
        throw new Error("Для инвестора нужен Solana wallet. Подключите Phantom или вставьте адрес вручную.")
      }

      await register({
        email: formData.email,
        password: formData.password,
        role: formData.role,
        legal_name: formData.fullName || undefined,
        country: formData.country || undefined,
        wallet_address: formData.role === "investor" ? formData.walletAddress.trim() : undefined,
      })

      const currentUser = await login({
        email: formData.email,
        password: formData.password,
      })
      router.replace(getDefaultRouteForRole(currentUser.role))
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message)
      } else if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError("Не удалось зарегистрировать пользователя.")
      }
    } finally {
      setIsSubmitting(false)
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
            <h1 className="text-2xl font-bold text-foreground mb-2">Создать аккаунт</h1>
            <p className="text-muted-foreground text-sm">
              Регистрация активирует аккаунт сразу. Для investor доступно подключение Phantom.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="role" className="text-xs uppercase tracking-wider text-muted-foreground">
                Роль
              </Label>
              <select
                id="role"
                value={formData.role}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, role: event.target.value as RegistrationRole }))
                }
                className="h-12 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {registrationRoleOptions.map((roleOption) => (
                  <option key={roleOption.value} value={roleOption.value}>
                    {roleOption.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-xs uppercase tracking-wider text-muted-foreground">
                Полное имя / компания
              </Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(event) => setFormData((current) => ({ ...current, fullName: event.target.value }))}
                className="h-12 bg-card border-border focus:border-primary focus:ring-primary/20"
                placeholder="Иван Иванов / Example Labs LLC"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country" className="text-xs uppercase tracking-wider text-muted-foreground">
                Страна
              </Label>
              <Input
                id="country"
                type="text"
                value={formData.country}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, country: event.target.value.toUpperCase() }))
                }
                className="h-12 bg-card border-border focus:border-primary focus:ring-primary/20"
                placeholder="US"
                maxLength={3}
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
                onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                className="h-12 bg-card border-border focus:border-primary focus:ring-primary/20"
                placeholder="email@example.com"
                autoComplete="email"
                required
              />
            </div>

            {formData.role === "investor" && (
              <div className="rounded-xl border border-border bg-background/40 p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Solana Wallet</p>
                    <p className="text-xs text-muted-foreground">
                      Подключите Phantom для investor-flow или вставьте адрес вручную.
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
                  onClick={handleConnectWallet}
                  disabled={isConnecting || providerStatus === "unsupported"}
                  className="w-full justify-center"
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Wallet className="h-4 w-4 mr-2" />
                      {connectedAddress ? "Переподключить Phantom" : "Подключить Phantom"}
                    </>
                  )}
                </Button>

                <div className="space-y-2">
                  <Label htmlFor="walletAddress" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Wallet Address
                  </Label>
                  <Input
                    id="walletAddress"
                    type="text"
                    value={formData.walletAddress}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, walletAddress: event.target.value.trim() }))
                    }
                    className="h-12 bg-card border-border focus:border-primary focus:ring-primary/20"
                    placeholder="Solana wallet address"
                    required
                  />
                </div>

                <div className="rounded-lg border border-border/70 bg-card/40 px-3 py-2 text-xs text-muted-foreground">
                  <div>Provider: {providerStatus === "ready" ? "Phantom detected" : "Phantom not detected"}</div>
                  <div>Connected wallet: {formatWalletAddress(connectedAddress)}</div>
                  <div>Cluster: Solana Devnet</div>
                  <div>Balance: {balanceSOL != null ? `${balanceSOL.toFixed(4)} SOL` : "Unavailable"}</div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">
                Пароль
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(event) => setFormData((current) => ({ ...current, password: event.target.value }))}
                  className="h-12 bg-card border-border focus:border-primary focus:ring-primary/20 pr-12"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  minLength={8}
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

            <div className="flex items-start gap-3">
              <input
                id="terms"
                type="checkbox"
                checked={formData.acceptTerms}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, acceptTerms: event.target.checked }))
                }
                className="mt-1 h-4 w-4 shrink-0 rounded border border-border accent-primary"
              />
              <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                Я подтверждаю согласие с правилами платформы и обработкой данных для работы MVP.
              </Label>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !formData.acceptTerms}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm uppercase tracking-wider"
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Зарегистрироваться"}
            </Button>
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
