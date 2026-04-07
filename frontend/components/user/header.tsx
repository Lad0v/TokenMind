'use client'

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { Menu, LogOut, X } from "lucide-react"
import { useMemo, useState } from "react"

import { IPChainLogo } from "@/components/ipchain-logo"
import { Button } from "@/components/ui/button"
import { getDefaultRouteForRole } from "@/lib/api"
import { useSession } from "@/components/providers/session-provider"

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, status, logout } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const dashboardHref = useMemo(() => {
    if (!user) {
      return "/issuer"
    }
    return getDefaultRouteForRole(user.role)
  }, [user])

  const handleLogout = async () => {
    await logout()
    router.replace("/auth/login")
  }

  const userInitials = user?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || user?.email.slice(0, 2).toUpperCase() || "TM"

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <IPChainLogo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href={dashboardHref}
            className={`text-sm transition-colors ${
              pathname?.startsWith("/admin") || pathname?.startsWith("/issuer") || pathname?.startsWith("/investor")
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Дашборд
          </Link>

          <Link
            href="/marketplace"
            className={`text-sm transition-colors ${
              pathname === "/marketplace"
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Маркетплейс
          </Link>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {status === "authenticated" && user ? (
            <>
              <Link
                href="/profile"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary transition-colors hover:bg-primary/30"
              >
                {userInitials}
              </Link>
              <Button variant="outline" size="sm" className="border-border" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Выйти
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild className="justify-center">
                <Link href="/auth/login">Войти</Link>
              </Button>
              <Button asChild className="justify-center">
                <Link href="/auth/register">Начать</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg md:hidden"
          onClick={() => setMobileMenuOpen((current) => !current)}
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5 text-foreground" />
          ) : (
            <Menu className="h-5 w-5 text-foreground" />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-border/40 bg-background/95 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-2 p-4">
            <Link
              href={dashboardHref}
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Дашборд
            </Link>
            <Link
              href="/marketplace"
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Маркетплейс
            </Link>
            <div className="mt-4 flex flex-col gap-2 border-t border-border/40 pt-4">
              {status === "authenticated" && user ? (
                <Button
                  variant="outline"
                  className="justify-center"
                  onClick={async () => {
                    setMobileMenuOpen(false)
                    await handleLogout()
                  }}
                >
                  Выйти
                </Button>
              ) : (
                <>
                  <Button variant="ghost" asChild className="justify-center">
                    <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                      Войти
                    </Link>
                  </Button>
                  <Button asChild className="justify-center">
                    <Link href="/auth/register" onClick={() => setMobileMenuOpen(false)}>
                      Начать
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
