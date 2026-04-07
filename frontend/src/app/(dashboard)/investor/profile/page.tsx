'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowUpRight, Coins, MessageCircle, ShieldCheck, Wallet } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import {
  earningsSeries,
  initialProfileStats,
  initialWalletState,
  pulseProfileStats,
  pulseWalletBalance,
  type ProfileStats,
  type WalletState,
} from '@/lib/investor-dashboard-data';

const interactions = [
  { title: 'Новые комментарии по портфелю', value: 18, icon: MessageCircle },
  { title: 'Подписки на стратегии', value: 42, icon: ArrowUpRight },
  { title: 'Проверенные контрагенты', value: 12, icon: ShieldCheck },
];

interface PhantomProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
  }
}

export default function InvestorProfilePage() {
  const [wallet, setWallet] = useState<WalletState>(initialWalletState);

  const [stats, setStats] = useState<ProfileStats>(initialProfileStats);

  const [lastSync, setLastSync] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setStats((prev) => pulseProfileStats(prev));

      setWallet((prev) => pulseWalletBalance(prev));

      setLastSync(new Date());
    }, 4500);

    return () => clearInterval(timer);
  }, []);

  const quickActions = useMemo(
    () => [
      { label: 'Активные токены', href: '/investor/tokens' },
      { label: 'Портфель', href: '/investor/portfolio' },
      { label: 'Маркетплейс', href: '/investor/marketplace' },
    ],
    [],
  );

  const connectWallet = async () => {
    if (!window.solana?.isPhantom) {
      setWallet((prev) => ({ ...prev, connected: false }));
      return;
    }

    try {
      const response = await window.solana.connect();
      const address = response.publicKey.toString();
      setWallet((prev) => ({
        ...prev,
        connected: true,
        address: `${address.slice(0, 4)}...${address.slice(-4)}`,
      }));
    } catch {
      setWallet((prev) => ({ ...prev, connected: false }));
    }
  };

  return (
    <div className="space-y-8 pb-28">
      <section className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] font-tech" style={{ color: 'var(--accent)' }}>
            Investor Profile
          </p>
          <h1 className="text-4xl font-elegant">Профиль пользователя</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Управление кошельком, доходностью и взаимодействиями в едином центре управления.
          </p>
        </div>

        <div className="text-xs px-3 py-2 rounded-xl border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
          <span className="inline-flex items-center gap-2">
            <Activity size={14} className="text-emerald-400" />
            Обновлено: {lastSync.toLocaleTimeString('ru-RU')}
          </span>
        </div>
      </section>

      <section className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-6">
            <h2 className="text-2xl font-elegant">Заработок за неделю</h2>
            <span className="text-sm text-emerald-400">+{stats.monthlyYieldPct}% / мес</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={earningsSeries}>
                <defs>
                  <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.55)" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    background: 'rgba(10, 16, 12, 0.95)',
                    border: '1px solid rgba(52, 211, 153, 0.2)',
                  }}
                />
                <Area type="monotone" dataKey="earned" stroke="#34d399" fill="url(#earningsGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl font-elegant mb-4">Solana Wallet</h2>
          <div className="space-y-4">
            <Row label="Статус" value={wallet.connected ? 'Connected' : 'Disconnected'} />
            <Row label="Адрес" value={wallet.address} />
            <Row label="Сеть" value={wallet.network} />
            <Row label="Баланс" value={`${wallet.balanceSOL.toFixed(2)} SOL`} />
          </div>
          <button
            onClick={connectWallet}
            className="mt-6 w-full rounded-xl py-2.5 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Wallet size={16} />
            {wallet.connected ? 'Переподключить кошелек' : 'Подключить Phantom'}
          </button>
        </Card>
      </section>

      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Earned', value: `${stats.totalEarnedSOL.toFixed(2)} SOL` },
          { label: 'Claimable Rewards', value: `${stats.claimableSOL.toFixed(2)} SOL` },
          { label: 'Followers', value: `${stats.followers}` },
          { label: 'Copied Strategies', value: `${stats.copiedStrategies}` },
        ].map((metric) => (
          <Card key={metric.label} className="p-6 gap-2">
            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>{metric.label}</p>
            <p className="text-3xl mt-2 font-elegant">{metric.value}</p>
          </Card>
        ))}
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {interactions.map((item) => (
          <Card key={item.title} className="p-6 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.title}</p>
              <p className="text-3xl mt-2 font-elegant">{item.value}</p>
            </div>
            <item.icon className="text-emerald-400" />
          </Card>
        ))}
      </section>

      <QuickMiniWindow quickActions={quickActions} claimable={stats.claimableSOL} />
    </div>
  );
}

function QuickMiniWindow({ quickActions, claimable }: { quickActions: Array<{ label: string; href: string }>; claimable: number }) {
  return (
    <aside className="fixed bottom-5 right-5 z-20 w-[min(92vw,290px)] rounded-2xl border p-4 shadow-2xl backdrop-blur-md" style={{ background: 'rgba(10, 18, 13, 0.9)', borderColor: 'rgba(52, 211, 153, 0.22)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="font-medium text-sm">Мини-окно</p>
        <span className="text-xs text-emerald-300">Realtime</span>
      </div>

      <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.18)' }}>
        <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Claimable now</p>
        <p className="text-xl mt-1 font-semibold inline-flex items-center gap-2">
          <Coins size={17} className="text-emerald-400" />
          {claimable.toFixed(2)} SOL
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-lg px-3 py-2 text-sm border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
