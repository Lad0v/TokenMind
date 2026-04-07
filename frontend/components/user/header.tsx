"use client";

import Link from "next/link";
import { Menu, LogOut, Wallet, X } from "lucide-react";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { IPChainLogo } from "@/components/ipchain-logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { shortenAddress } from "@/lib/format";


export function Header() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const pathname = usePathname()
    const { user, walletAddress, logout, connectWallet } = useAuth()

    const navItems = useMemo(() => {
        if (user?.role === "issuer") {
            return [
                { href: "/issuer", label: "Кабинет" },
                { href: "/marketplace", label: "Маркетплейс" },
            ]
        }

        if (user?.role === "investor") {
            return [
                { href: "/marketplace", label: "Маркетплейс" },
                { href: "/investor/portfolio", label: "Портфель" },
            ]
        }

        if (user?.role === "admin") {
            return [
                { href: "/admin", label: "Админ" },
                { href: "/marketplace", label: "Маркетплейс" },
            ]
        }

        return [
            { href: "/marketplace", label: "Маркетплейс" },
        ]
    }, [user?.role])

    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <Link href="/" className="flex items-center gap-2">
                    <IPChainLogo/>
                </Link>

                <nav className="hidden items-center gap-8 md:flex">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`text-sm transition-colors ${
                                pathname === item.href
                                    ? "text-foreground font-medium"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="flex items-center gap-3">
                    {walletAddress ? (
                        <Button variant="outline" size="sm" className="border-border">
                            <Wallet className="h-4 w-4 mr-2" />
                            {shortenAddress(walletAddress)}
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" className="border-border" onClick={() => void connectWallet()}>
                            <Wallet className="h-4 w-4 mr-2" />
                            Connect
                        </Button>
                    )}

                    {user ? (
                        <>
                            <Link
                                href={user.role === "investor" ? "/investor/portfolio" : user.role === "issuer" ? "/issuer" : "/admin"}
                                className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors"
                            >
                                <span className="text-sm font-medium text-primary">
                                    {(user.name ?? user.role).slice(0, 2).toUpperCase()}
                                </span>
                            </Link>
                            <Button variant="ghost" size="icon" onClick={logout} aria-label="Logout">
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </>
                    ) : (
                        <div className="hidden items-center gap-2 md:flex">
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/auth/login">Войти</Link>
                            </Button>
                            <Button size="sm" asChild>
                                <Link href="/auth/register">Регистрация</Link>
                            </Button>
                        </div>
                    )}
                </div>

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

            {mobileMenuOpen && (
                <div className="border-t border-border/40 bg-background/95 backdrop-blur-xl md:hidden">
                    <nav className="flex flex-col gap-2 p-4">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <div className="mt-4 flex flex-col gap-2 border-t border-border/40 pt-4">
                            {user ? (
                                <Button variant="ghost" className="justify-center" onClick={logout}>
                                    Выйти
                                </Button>
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
                    </nav>
                </div>
            )}
        </header>
    )
}
