"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Shield, Menu, X } from "lucide-react"
import { useState } from "react"
import { TokenMindLogo } from "@/components/tokenmind-logo"

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <TokenMindLogo />
          {/*<span className="text-xl font-semibold text-foreground">TokenMind</span>*/}
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          <Link href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Возможности
          </Link>
          <Link href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Как это работает
          </Link>
          <Link href="#marketplace" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Маркетплейс
          </Link>
          <Link href="#security" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Безопасность
          </Link>
        </nav>

        {/* Desktop Auth Buttons */}
        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" asChild>
            <Link href="/auth/login">Войти</Link>
          </Button>
          <Button asChild>
            <Link href="/auth/register">Создать Аккаунт</Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5 text-foreground" />
          ) : (
            <Menu className="h-5 w-5 text-foreground" />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-border/40 bg-background/95 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-2 p-4">
            <Link
              href="#features"
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Возможности
            </Link>
            <Link
              href="#how-it-works"
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Как это работает
            </Link>
            <Link
              href="/marketplace"
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Маркетплейс
            </Link>
            <Link
              href="#security"
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Безопасность
            </Link>
            <div className="mt-4 flex flex-col gap-2 border-t border-border/40 pt-4">
              <Button variant="ghost" asChild className="justify-center">
                <Link href="/auth/login">Войти</Link>
              </Button>
              <Button asChild className="justify-center">
                <Link href="/auth/register">Начать</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
