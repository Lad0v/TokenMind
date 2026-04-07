'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AppShell({ children, role }: { children: React.ReactNode, role: string }) {
  const pathname = usePathname();

  const isIssuer = role === 'issuer';
  const isInvestor = role === 'investor';
  const isAdmin = role === 'admin';

  return (
    <div className="min-h-screen flex text-sm" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r fixed h-full z-10 hidden md:flex flex-col" style={{ borderColor: 'var(--border-color)', backgroundColor: 'rgba(13, 34, 25, 0.95)', backdropFilter: 'blur(10px)' }}>
        <div className="p-6 h-16 flex items-center gap-3">
          <div className="relative w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
            <div className="w-4 h-4 rounded-sm" style={{ background: 'var(--accent)' }} />
          </div>
          <span className="font-semibold text-lg tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            VeriMint
          </span>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          {/* Guest / Common */}
          <NavItem href="/" icon="❖" label="Home" active={pathname === '/'} />
          <NavItem href="/investor/marketplace" icon="⌗" label="Marketplace" active={pathname.startsWith('/investor/marketplace')} />

          {/* User / KYC */}
          {role !== 'guest' && (
            <div className="pt-4 pb-2">
              <span className="px-3 text-[11px] uppercase tracking-widest font-semibold text-emerald-600/60">Account</span>
              <NavItem href="/kyc" icon="✓" label="KYC Verifications" active={pathname.startsWith('/kyc')} />
            </div>
          )}

          {/* Issuer */}
          {isIssuer && (
            <div className="pt-4 pb-2">
              <span className="px-3 text-[11px] uppercase tracking-widest font-semibold text-emerald-600/60">Issuer Portal</span>
              <NavItem href="/issuer" icon="◩" label="Dashboard" active={pathname === '/issuer'} />
              <NavItem href="/issuer/claims/new" icon="+" label="New Patent" active={pathname === '/issuer/claims/new'} />
            </div>
          )}

          {/* Investor */}
          {isInvestor && (
            <div className="pt-4 pb-2">
              <span className="px-3 text-[11px] uppercase tracking-widest font-semibold text-emerald-600/60">Investor</span>
              <NavItem href="/investor/portfolio" icon="◔" label="Portfolio" active={pathname.startsWith('/investor/portfolio')} />
            </div>
          )}

          {/* Admin */}
          {isAdmin && (
            <div className="pt-4 pb-2">
              <span className="px-3 text-[11px] uppercase tracking-widest font-semibold text-emerald-600/60">Admin</span>
              <NavItem href="/admin" icon="◧" label="Dashboard" active={pathname === '/admin'} />
              <NavItem href="/admin/kyc" icon="⚑" label="KYC Queue" active={pathname === '/admin/kyc'} />
              <NavItem href="/admin/claims" icon="◎" label="IP Reviews" active={pathname === '/admin/claims'} />
            </div>
          )}
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ backgroundColor: 'rgba(52, 211, 153, 0.05)' }}>
            <div className="font-medium">
              <div>{role.toUpperCase()}</div>
              <div className="text-xs text-green-500/70">W1A2...z9X</div>
            </div>
            {role !== 'guest' && (
              <button onClick={() => window.location.href = '/'} className="text-red-400 hover:text-red-300">
                Exit
              </button>
            )}
            {role === 'guest' && (
              <a href="/auth/sign-in" className="text-emerald-400 font-medium">Log In</a>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 border-b flex items-center justify-between px-6 sticky top-0 z-10" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-emerald-500/80 hidden sm:inline-block border border-emerald-500/20 px-2 py-1 rounded bg-emerald-500/5">
              Solana Mainnet V3
            </span>
            <div className="w-8 h-8 rounded-full border border-emerald-500/30 overflow-hidden bg-emerald-500/10" />
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6 md:p-10 flex-1 overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, icon, label, active }: { href: string, icon: string, label: string, active: boolean }) {
  return (
    <Link href={href} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
      active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
    }`}>
      <span className="w-5 text-center text-lg">{icon}</span>
      <span className="font-medium tracking-wide">{label}</span>
    </Link>
  );
}
