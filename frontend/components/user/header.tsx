'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Menu, User, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { TokenMindLogo } from '@/components/tokenmind-logo'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/auth-context'

function resolveIssuerHref() {
  return '/issuer'
}

function getUserInitials(name?: string | null, email?: string | null) {
  const source = (name || email || 'TM').trim()
  if (!source) return 'TM'

  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }

  return source.slice(0, 2).toUpperCase()
}

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const issuerHref = useMemo(() => resolveIssuerHref(), [])
  const userInitials = useMemo(() => getUserInitials(user?.name ?? null, user?.email ?? null), [user?.name, user?.email])

  const handleLogout = async () => {
    await logout()
    router.replace('/')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <TokenMindLogo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href={issuerHref}
            className={`text-sm transition-colors ${
              pathname?.startsWith('/admin') || pathname?.startsWith('/issuer')
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Эмитент
          </Link>

          <Link
            href="/investor"
            className={`text-sm transition-colors ${
              pathname?.startsWith('/investor')
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Инвестиции
          </Link>

          <Link
            href="/marketplace"
            className={`text-sm transition-colors ${
              pathname?.startsWith('/marketplace')
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Маркетплейс
          </Link>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isLoading ? (
            <div className="h-10 w-10 rounded-full bg-secondary animate-pulse" />
          ) : isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary transition-colors hover:bg-primary/30"
                  aria-label="Profile menu"
                >
                  {userInitials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="h-4 w-4" />
                    Профиль
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    void handleLogout()
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
              href={issuerHref}
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Эмитент
            </Link>
            <Link
              href="/investor"
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Инвестиции
            </Link>
            <Link
              href="/marketplace"
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Маркетплейс
            </Link>

            <div className="mt-4 flex flex-col gap-2 border-t border-border/40 pt-4">
              {isLoading ? (
                <div className="h-10 w-full rounded-md bg-secondary animate-pulse" />
              ) : isAuthenticated ? (
                <>
                  <Button variant="ghost" asChild className="justify-center">
                    <Link href="/profile" onClick={() => setMobileMenuOpen(false)}>
                      Профиль
                    </Link>
                  </Button>
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
                </>
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
