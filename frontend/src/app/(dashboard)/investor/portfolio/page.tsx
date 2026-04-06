'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type PortfolioTab = 'overview' | 'tokens' | 'history';

type Holding = {
  asset: string;
  ticker: string;
  tokens: number;
  avgPrice: number;
  currentPrice: number;
  status: string;
};

const holdings: Holding[] = [
  { asset: 'NanoSeal Patent', ticker: 'NSP', tokens: 190, avgPrice: 0.41, currentPrice: 0.50, status: 'active' },
  { asset: 'BioInk Formula', ticker: 'BIF', tokens: 120, avgPrice: 0.36, currentPrice: 0.49, status: 'active' },
  { asset: 'Photon Core', ticker: 'PHC', tokens: 60, avgPrice: 0.88, currentPrice: 1.1, status: 'tokenized' },
  { asset: 'Quantum Print Stack', ticker: 'QPS', tokens: 75, avgPrice: 0.52, currentPrice: 0.47, status: 'under_review' },
];

const transactions = [
  { id: 'TX-9821', date: '31 Mar 2026', asset: 'NanoSeal Patent', action: 'Buy', amount: '40 NSP', total: '20.0 SOL' },
  { id: 'TX-9765', date: '28 Mar 2026', asset: 'Photon Core', action: 'Buy', amount: '15 PHC', total: '16.5 SOL' },
  { id: 'TX-9680', date: '25 Mar 2026', asset: 'BioInk Formula', action: 'Buy', amount: '35 BIF', total: '17.2 SOL' },
];

export default function InvestorPortfolioPage() {
  const [activeTab, setActiveTab] = useState<PortfolioTab>('overview');

  const stats = useMemo(() => {
    const invested = holdings.reduce((sum, item) => sum + item.tokens * item.avgPrice, 0);
    const current = holdings.reduce((sum, item) => sum + item.tokens * item.currentPrice, 0);
    const pnl = current - invested;
    const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

    return {
      invested,
      current,
      pnl,
      pnlPercent,
    };
  }, []);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.22em] font-tech" style={{ color: 'var(--accent)' }}>
          Investor Portfolio
        </p>
        <h1 className="text-4xl font-elegant">Портфель инвестора</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Здесь отображаются купленные токены, средняя цена входа, текущая оценка и доходность портфеля.
        </p>
      </section>

      <section className="flex flex-wrap gap-2">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
          Обзор
        </TabButton>
        <TabButton active={activeTab === 'tokens'} onClick={() => setActiveTab('tokens')}>
          Купленные токены
        </TabButton>
        <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
          История сделок
        </TabButton>
      </section>

      <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Текущая стоимость" value={`${stats.current.toFixed(2)} SOL`} />
        <MetricCard label="Вложено" value={`${stats.invested.toFixed(2)} SOL`} />
        <MetricCard
          label="Нереализованный PnL"
          value={`${stats.pnl >= 0 ? '+' : ''}${stats.pnl.toFixed(2)} SOL`}
          accent={stats.pnl >= 0 ? 'positive' : 'negative'}
        />
        <MetricCard
          label="Доходность"
          value={`${stats.pnl >= 0 ? '+' : ''}${stats.pnlPercent.toFixed(2)}%`}
          accent={stats.pnl >= 0 ? 'positive' : 'negative'}
        />
      </section>

      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2">
            <h2 className="text-2xl font-elegant mb-4">Ключевые позиции</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Тикер</TableHead>
                  <TableHead>Токены</TableHead>
                  <TableHead>Средняя цена</TableHead>
                  <TableHead>Текущая цена</TableHead>
                  <TableHead>PnL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.slice(0, 3).map((item) => {
                  const pnl = (item.currentPrice - item.avgPrice) * item.tokens;

                  return (
                    <TableRow key={item.ticker}>
                      <TableCell className="font-medium">{item.asset}</TableCell>
                      <TableCell>{item.ticker}</TableCell>
                      <TableCell>{item.tokens}</TableCell>
                      <TableCell>{item.avgPrice.toFixed(2)} SOL</TableCell>
                      <TableCell>{item.currentPrice.toFixed(2)} SOL</TableCell>
                      <TableCell className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {pnl >= 0 ? '+' : ''}
                        {pnl.toFixed(2)} SOL
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          <Card>
            <h2 className="text-2xl font-elegant mb-4">Распределение</h2>
            <div className="space-y-3">
              {holdings.map((item) => {
                const positionValue = item.tokens * item.currentPrice;
                const allocationPercent = (positionValue / stats.current) * 100;

                return (
                  <div key={item.ticker}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>{item.ticker}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{allocationPercent.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: 'rgba(52,211,153,0.08)' }}>
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${allocationPercent}%`,
                          background: 'linear-gradient(90deg, rgba(52,211,153,0.75), rgba(16,185,129,0.95))',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'tokens' && (
        <Card>
          <h2 className="text-2xl font-elegant mb-4">Купленные токены</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead>Количество</TableHead>
                <TableHead>Средняя цена</TableHead>
                <TableHead>Текущая цена</TableHead>
                <TableHead>Стоимость позиции</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((item) => (
                <TableRow key={item.ticker}>
                  <TableCell className="font-medium">{item.asset}</TableCell>
                  <TableCell>{item.ticker}</TableCell>
                  <TableCell>{item.tokens} токенов</TableCell>
                  <TableCell>{item.avgPrice.toFixed(2)} SOL</TableCell>
                  <TableCell>{item.currentPrice.toFixed(2)} SOL</TableCell>
                  <TableCell>{(item.tokens * item.currentPrice).toFixed(2)} SOL</TableCell>
                  <TableCell>
                    <PortfolioStatus status={item.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {activeTab === 'history' && (
        <Card>
          <h2 className="text-2xl font-elegant mb-4">История сделок</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Действие</TableHead>
                <TableHead>Количество</TableHead>
                <TableHead>Сумма</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.date}</TableCell>
                  <TableCell className="font-medium">{item.asset}</TableCell>
                  <TableCell className="text-emerald-400">{item.action}</TableCell>
                  <TableCell>{item.amount}</TableCell>
                  <TableCell>{item.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 rounded-xl border text-sm font-medium transition-colors duration-200"
      style={{
        borderColor: active ? 'rgba(52,211,153,0.35)' : 'var(--border-color)',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        background: active ? 'rgba(52,211,153,0.08)' : 'rgba(13,34,25,0.55)',
      }}
    >
      {children}
    </button>
  );
}

function MetricCard({
  label,
  value,
  accent = 'default',
}: {
  label: string;
  value: string;
  accent?: 'default' | 'positive' | 'negative';
}) {
  const accentColor = accent === 'positive' ? '#34d399' : accent === 'negative' ? '#f87171' : 'var(--text-primary)';

  return (
    <Card>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </p>
      <p className="text-3xl mt-2 font-elegant" style={{ color: accentColor }}>
        {value}
      </p>
    </Card>
  );
}

function PortfolioStatus({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  const colorClass =
    normalized === 'active' || normalized === 'tokenized'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : normalized === 'under_review'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        : 'border-gray-500/30 bg-gray-500/10 text-gray-300';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-wide ${colorClass}`}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}
