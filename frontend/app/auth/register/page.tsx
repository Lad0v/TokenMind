"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle, Loader2, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TokenMindLogo } from "@/components/tokenmind-logo"
import { useWallet } from "@/components/providers/wallet-provider"
import { useRegister } from "@/hooks/use-api"
import { getUserFriendlyErrorMessage } from "@/lib/error-handler"

const COUNTRY_OPTIONS: Array<{ code: string; name: string }> = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "CH", name: "Switzerland" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "FI", name: "Finland" },
  { code: "PL", name: "Poland" },
  { code: "CZ", name: "Czech Republic" },
  { code: "PT", name: "Portugal" },
  { code: "IE", name: "Ireland" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "CN", name: "China" },
  { code: "IN", name: "India" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "TR", name: "Turkey" },
  { code: "IL", name: "Israel" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "MX", name: "Mexico" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "RU", name: "Russia" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "UA", name: "Ukraine" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "TJ", name: "Tajikistan" },
]

export default function RegisterPage() {
  const router = useRouter()
  const { connectedAddress, providerStatus, isConnecting: walletLoading, connect } = useWallet()
  const { execute: register, loading: registerLoading, error: registerError } = useRegister()
  const isAvailable = providerStatus === "ready"
  const walletAddress = connectedAddress

  const [formData, setFormData] = useState({
    email: "",
    legalName: "",
    country: "",
  })
  const [registrationSuccess, setRegistrationSuccess] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleWalletConnect = async () => {
    setLocalError(null)
    try {
      await connect()
    } catch (error) {
      setLocalError(getUserFriendlyErrorMessage(error))
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLocalError(null)

    if (!walletAddress) {
      setLocalError("Connect Phantom wallet first.")
      return
    }

    try {
      await register({
        email: formData.email.trim(),
        solana_wallet_address: walletAddress,
        legal_name: formData.legalName.trim() || undefined,
        country: formData.country || undefined,
      })

      setRegistrationSuccess(true)
      setTimeout(() => {
        router.replace("/auth/login")
      }, 1600)
    } catch (error) {
      setLocalError(getUserFriendlyErrorMessage(error))
    }
  }

  const isLoading = walletLoading || registerLoading
  const errorMessage = registerError || localError

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
            <h2 className="text-2xl font-bold text-foreground mb-2">Registration successful</h2>
            <p className="text-muted-foreground mb-6">
              Account created. Redirecting to wallet login...
            </p>
            <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/auth/login">Go to Login</Link>
            </Button>
            <Button asChild variant="outline" className="mt-3 w-full">
              <Link href="/">На главную</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-3">
          <Button asChild variant="ghost" className="px-0 text-muted-foreground hover:text-foreground">
            <Link href="/">На главную</Link>
          </Button>
        </div>

        <div className="flex justify-center mb-8">
          <TokenMindLogo size="lg" showText />
        </div>

        <div className="bg-card/50 border border-border rounded-2xl p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Create Account</h1>
            <p className="text-muted-foreground text-sm">
              API v3.1 registration requires email and Solana wallet.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-6 p-4 rounded-lg border border-destructive/30 bg-destructive/5 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          )}

          {!isAvailable && (
            <div className="mb-6 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-700">
                <p className="font-medium mb-1">Phantom wallet not found</p>
                <p className="text-xs text-yellow-700/80">
                  Please install{" "}
                  <a
                    href="https://phantom.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-yellow-800"
                  >
                    Phantom
                  </a>{" "}
                  to continue.
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
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wallet className="h-5 w-5" />}
              {isLoading ? "Connecting..." : "Connect Wallet"}
            </Button>
          ) : (
            <>
              <div className="p-4 rounded-lg border border-border bg-card mb-6">
                <p className="text-xs text-muted-foreground mb-2">Connected wallet:</p>
                <p className="text-sm font-mono text-foreground break-all">{walletAddress}</p>
                <Button
                  onClick={handleWalletConnect}
                  variant="ghost"
                  size="sm"
                  className="mt-3 h-8 text-xs"
                  disabled={isLoading}
                >
                  Change Wallet
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
                    onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                    className="h-12 bg-card border-border focus:border-primary focus:ring-primary/20"
                    placeholder="your@email.com"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="legalName" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Legal Name (optional)
                  </Label>
                  <Input
                    id="legalName"
                    type="text"
                    value={formData.legalName}
                    onChange={(event) => setFormData((current) => ({ ...current, legalName: event.target.value }))}
                    className="h-12 bg-card border-border focus:border-primary focus:ring-primary/20"
                    placeholder="John Doe or Acme LLC"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Country Code (optional)
                  </Label>
                  <select
                    id="country"
                    value={formData.country}
                    onChange={(event) => setFormData((current) => ({ ...current, country: event.target.value }))}
                    className="h-12 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20"
                    disabled={isLoading}
                  >
                    <option value="">Select country</option>
                    {COUNTRY_OPTIONS.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                  {formData.country && (
                    <p className="text-xs text-muted-foreground">Будет отправлен код страны: {formData.country}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !formData.email}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm uppercase tracking-wider"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Register"}
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary hover:underline font-medium">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
