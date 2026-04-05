import Link from "next/link"
import { Shield } from "lucide-react"
import {IPChainLogo} from "@/components/ipchain-logo";

const footerLinks = {
  platform: [
    { name: "Маркетплейс", href: "/marketplace" },
    { name: "Для инвесторов", href: "/portfolio" },
    { name: "Для правообладателей", href: "/issuer" },
    { name: "KYC верификация", href: "/kyc" }
  ],
  company: [
    { name: "О нас", href: "/about" },
    { name: "Блог", href: "/blog" },
    { name: "Карьера", href: "/careers" },
    { name: "Контакты", href: "/contact" }
  ],
  legal: [
    { name: "Условия использования", href: "/terms" },
    { name: "Политика конфиденциальности", href: "/privacy" },
    { name: "AML политика", href: "/aml" },
    { name: "Юридическая информация", href: "/legal" }
  ],
  social: [
    { name: "Twitter", href: "https://twitter.com" },
    { name: "Discord", href: "https://discord.com" },
    { name: "Telegram", href: "https://telegram.org" },
    { name: "GitHub", href: "https://github.com" }
  ]
}

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-6">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <IPChainLogo/>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Платформа для верификации и токенизации интеллектуальной собственности на блокчейне Solana.
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span>Работает на Solana Mainnet</span>
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Платформа</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.platform.map((link) => (
                <li key={link.name}>
                  <Link 
                    href={link.href} 
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">Компания</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link 
                    href={link.href} 
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">Правовая информация</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link 
                    href={link.href} 
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">Социальные сети</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.social.map((link) => (
                <li key={link.name}>
                  <Link 
                    href={link.href} 
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/40 pt-8 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            © 2026 VeriMint. Все права защищены.
          </p>
          <div className="flex items-center gap-6">
            <Link 
              href="/terms" 
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Условия использования
            </Link>
            <Link 
              href="/privacy" 
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Политика конфиденциальности
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
