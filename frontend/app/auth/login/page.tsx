"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { IPChainLogo } from "@/components/ipchain-logo"
import { Loader2, Wallet, AlertCircle } from "lucide-react"
import { useWallet } from "@/hooks/use-wallet"
import { useLoginWithWallet } from "@/hooks/use-api"
import { useAuth } from "@/lib/auth-context"
import { getUserFriendlyErrorMessage } from "@/lib/error-handler"
import { USER_ROLES } from "@/config/constants"

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, role } = useAuth()
  const { walletAddress, isLoading: walletLoading, isAvailable, error: walletError, connect } = useWallet()
  const { execute: login, loading: loginLoading, error: loginError } = useLoginWithWallet()

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      if (role === USER_ROLES.INVESTOR) {
        router.push('/investor/dashboard')
      } else if (role === USER_ROLES.ISSUER) {
        router.push('/issuer/dashboard')
      } else if (role === USER_ROLES.ADMIN) {
        router.push('/admin/dashboard')
      } else {
        router.push('/marketplace')
      }
    }
  }, [isAuthenticated, role, router])

  const handleWalletConnect = async () => {
    try {
      await connect()
    } catch (err) {
      // Error is handled by useWallet hook
      console.error('Failed to connect wallet:', err)
    }
  }

  const handleLogin = async () => {
    if (!walletAddress) return

    try {
      const result = await login({ wallet_address: walletAddress })
      // Redirect is handled by useLoginWithWallet hook
    } catch (err) {
      // Error is shown to user
      console.error('Login failed:', err)
    }
  }

  const isLoading = walletLoading || loginLoading
  const error = walletError || loginError
  const errorMessage = error ? getUserFriendlyErrorMessage(error) : null

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
              Добро пожаловать в IPChain
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

          <div className="space-y-4">
            {!walletAddress ? (
              <Button
                onClick={handleWalletConnect}
                disabled={isLoading || !isAvailable}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm uppercase tracking-wider flex items-center justify-center gap-2"
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
                <div className="p-4 rounded-lg border border-border bg-card">
                  <p className="text-xs text-muted-foreground mb-2">Подключённый кошелек:</p>
                  <p className="text-sm font-mono text-foreground break-all">{walletAddress}</p>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleWalletConnect}
                    variant="outline"
                    className="flex-1 h-12 border-border hover:border-primary/50"
                    disabled={isLoading}
                  >
                    Изменить кошелек
                  </Button>

                  <Button
                    onClick={handleLogin}
                    disabled={isLoading}
                    className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm uppercase tracking-wider"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "Войти"
                    )}
                  </Button>
                </div>
              </>
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
//           </p>
//         </div>
//       </div>
//     </div>
//   )
// }
