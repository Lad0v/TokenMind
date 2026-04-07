import Link from "next/link";
import {IPChainLogo} from "@/components/ipchain-logo";
import {Button} from "@/components/ui/button";
import {Menu, Wallet, X} from "lucide-react";
import {useState} from "react";
import {usePathname} from "next/navigation";


export function Header(){
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const pathname = usePathname()

    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <IPChainLogo/>
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden items-center gap-8 md:flex">
                    <Link
                        href="/issuer"
                        className={`text-sm transition-colors ${
                            pathname === "/issuer"
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

                    <Link
                        href="/investor"
                        className={`text-sm transition-colors ${
                            pathname === "/investor"
                                ? "text-foreground font-medium"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        Инвестор
                    </Link>
                </nav>

                {/* Desktop Auth Buttons */}
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" className="border-border">
                        <Wallet className="h-4 w-4 mr-2" />
                        7xKX...gAsU
                    </Button>
                    {/*<div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">*/}
                    <Link href="/profile" className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors" >
                        <span className="text-sm font-medium text-primary">ИИ</span>
                    </Link>
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









// <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
//     <div className="container mx-auto px-4 lg:px-8">
//         <div className="flex h-16 items-center justify-between">
//             <Link href="/marketplace">
//                 <IPChainLogo size="sm" />
//             </Link>
//
//             <nav className="hidden md:flex items-center gap-8">
//                 <Link href="/marketplace" className="text-sm text-foreground font-medium">
//                     Маркетплейс
//                 </Link>
//                 <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
//                     Вход
//                 </Link>
//                 <Link href="/auth/register" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
//                     Регистрация
//                 </Link>
//             </nav>
//
//             <div className="flex items-center gap-3">
//                 <Button variant="ghost" asChild className="hidden sm:inline-flex">
//                     <Link href="/auth/login">Войти</Link>
//                 </Button>
//                 <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
//                     <Link href="/auth/register">
//                         Создать аккаунт
//                     </Link>
//                 </Button>
//             </div>
//         </div>
//     </div>
// </header>







// <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
//     <div className="container mx-auto px-4 lg:px-8">
//         <div className="flex h-16 items-center justify-between">
//             <div className="flex items-center gap-8">
//                 <Link href="/">
//                     <IPChainLogo size="sm" />
//                 </Link>
//
//                 <nav className="hidden md:flex items-center justify-between gap-6">
//                     <Link href="/issuer" className="text-sm text-foreground font-medium">
//                         Дашборд
//                     </Link>
//                     <Link href="/marketplace" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
//                         Маркетплейс
//                     </Link>
//                     <Link href="/portfolio" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
//                         Портфель
//                     </Link>
//                 </nav>
//             </div>
//
//             <div className="flex items-center gap-3">
//                 <Button variant="outline" size="sm" className="border-border">
//                     <Wallet className="h-4 w-4 mr-2" />
//                     7xKX...gAsU
//                 </Button>
//                 <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
//                     <span className="text-sm font-medium text-primary">ИИ</span>
//                 </div>
//             </div>
//         </div>
//     </div>
// </header>