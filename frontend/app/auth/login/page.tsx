"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TokenMindLogo } from "@/components/tokenmind-logo"
import { useWallet } from "@/components/providers/wallet-provider"
import { useAuth } from "@/lib/auth-context"
import { getUserFriendlyErrorMessage } from "@/lib/error-handler"
import { getDefaultRouteForRole } from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading: authLoading } = useAuth()
  const { connectedAddress, providerStatus, isConnecting: walletLoading, connect } = useWallet()

  const [loginError, setLoginError] = useState<string | null>(null)
  const isAvailable = providerStatus === "ready"
  const walletAddress = connectedAddress

  const handleWalletConnect = async () => {
    setLoginError(null)
    try {
      await connect()
    } catch (error) {
      setLoginError(getUserFriendlyErrorMessage(error))
    }
  }

  const handleLogin = async () => {
    if (!walletAddress) return
    setLoginError(null)
    try {
      const currentUser = await login(walletAddress)
      router.replace(getDefaultRouteForRole(currentUser.role))
    } catch (error) {
      setLoginError(getUserFriendlyErrorMessage(error))
    }
  }

  const isLoading = walletLoading || authLoading
  const errorMessage = loginError

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
            <h1 className="text-2xl font-bold text-foreground mb-2">Wallet Login</h1>
            <p className="text-muted-foreground text-sm">
              API v3.1: login is available only via Solana wallet
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

          <div className="space-y-4">
            {!walletAddress ? (
              <Button
                onClick={handleWalletConnect}
                disabled={isLoading || !isAvailable}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm uppercase tracking-wider flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wallet className="h-5 w-5" />}
                {isLoading ? "Connecting..." : "Connect Wallet"}
              </Button>
            ) : (
              <>
                <div className="p-4 rounded-lg border border-border bg-card">
                  <p className="text-xs text-muted-foreground mb-2">Connected wallet:</p>
                  <p className="text-sm font-mono text-foreground break-all">{walletAddress}</p>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleWalletConnect}
                    variant="outline"
                    className="flex-1 h-12 border-border hover:border-primary/50"
                    disabled={isLoading}
                  >
                    Change Wallet
                  </Button>

                  <Button
                    onClick={handleLogin}
                    disabled={isLoading}
                    className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm uppercase tracking-wider"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Login"}
                  </Button>
                </div>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            No account yet?{" "}
            <Link href="/auth/register" className="text-primary hover:underline font-medium">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
