'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Clock3, Coins, LineChart as LineChartIcon, RefreshCcw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  initialTokenHoldings,
  initialTokenTransactions,
  pulseTokenHoldings,
  type TokenHolding,
  type TokenTransaction,
} from '@/lib/investor-dashboard-data';

const projectionByMonth = [
  { month: 'May', dividend: 3.1 },
  { month: 'Jun', dividend: 3.8 },
  { month: 'Jul', dividend: 4.2 },
  { month: 'Aug', dividend: 4.7 },
  { month: 'Sep', dividend: 5.1 },
];

const buybackOptions = [
  { type: 'Мгновенный выкуп', premium: '+4.5%', eta: 'T+1' },
  { type: 'Аукцион выкупа', premium: '+8.2%', eta: 'T+3' },
  { type: 'Гибридный выкуп', premium: '+6.1%', eta: 'T+2' },
];

const actionColor: Record<TokenTransaction['action'], string> = {
  buy: 'text-emerald-300',
  buyback: 'text-amber-300',
  dividend: 'text-sky-300',
};

export default function ActiveTokensPage() {
  const [holdings, setHoldings] = useState<TokenHolding[]>(initialTokenHoldings);
  const [transactions] = useState<TokenTransaction[]>(initialTokenTransactions);
  const [lastSync, setLastSync] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setHoldings((prev) => pulseTokenHoldings(prev));
      setLastSync(new Date());
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const totalCurrentValue = useMemo(
    () => holdings.reduce((sum, item) => sum + item.quantity * item.marketPriceSOL, 0),
    [holdings],
  );

  const totalProjectedDividends = useMemo(
    () => holdings.reduce((sum, item) => sum + item.projectedDividendSOL, 0),
    [holdings],
  );

  const allocation = useMemo(
    () =>
      holdings.map((item) => ({
        name: item.asset,
        value: Number((item.quantity * item.marketPriceSOL).toFixed(2)),
      })),
    [holdings],
  );

  const pnlBars = useMemo(
    () =>
      holdings.map((item) => ({
        token: item.id,
        pnl: Number(((item.marketPriceSOL - item.avgBuyPriceSOL) * item.quantity).toFixed(2)),
      })),
    [holdings],
  );

  return (
    <div className="space-y-8">
      <section className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] font-tech" style={{ color: 'var(--accent)' }}>
            Investor Tokens
          </p>
          <h1 className="text-4xl font-elegant">Активные токены</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Покупки, выкуп, дивиденды и транзакционная активность по токенизированным IP-активам.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Link href="/investor/profile">
            <Button variant="outline">Профиль</Button>
          </Link>
          <Link href="/investor/portfolio">
            <Button variant="outline">Портфель</Button>
          </Link>
          <Button variant="outline" className="gap-2">
            <RefreshCcw size={15} />
            {lastSync.toLocaleTimeString('ru-RU')}
          </Button>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Total Token Value" value={`${totalCurrentValue.toFixed(2)} SOL`} icon={Coins} />
        <MetricCard label="Projected Dividends" value={`${totalProjectedDividends.toFixed(2)} SOL`} icon={LineChartIcon} />
        <MetricCard label="Holdings" value={`${holdings.length}`} icon={ArrowRightLeft} />
        <MetricCard label="Realtime Window" value="5 sec" icon={Clock3} />
      </section>

      <section className="grid xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 p-6">
          <h2 className="text-2xl font-elegant mb-4">Приобретенные токены</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Avg Buy</TableHead>
                <TableHead>Market</TableHead>
                <TableHead>Dividends</TableHead>
                <TableHead>Buyback Window</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((token) => (
                <TableRow key={token.id}>
                  <TableCell className="font-medium">{token.asset}</TableCell>
                  <TableCell>{token.quantity}</TableCell>
                  <TableCell>{token.avgBuyPriceSOL.toFixed(2)} SOL</TableCell>
                  <TableCell>{token.marketPriceSOL.toFixed(2)} SOL</TableCell>
                  <TableCell className="text-emerald-300">{token.projectedDividendSOL.toFixed(2)} SOL</TableCell>
                  <TableCell>{token.buybackWindow}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-elegant mb-4">Варианты выкупа</h2>
          <div className="space-y-3">
            {buybackOptions.map((option) => (
              <div
                key={option.type}
                className="rounded-xl border px-3 py-3"
                style={{ borderColor: 'rgba(52, 211, 153, 0.2)', background: 'rgba(52, 211, 153, 0.06)' }}
              >
                <p className="font-medium">{option.type}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Premium: {option.premium} • Settlement: {option.eta}
                </p>
                <Button variant="secondary" size="sm" className="mt-3 w-full">
                  Запросить
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 p-6">
          <h2 className="text-2xl font-elegant mb-4">История транзакций</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{tx.id}</TableCell>
                  <TableCell>{tx.tokenId}</TableCell>
                  <TableCell className={actionColor[tx.action]}>{tx.action.toUpperCase()}</TableCell>
                  <TableCell>{tx.amountSOL.toFixed(2)} SOL</TableCell>
                  <TableCell>{tx.date}</TableCell>
                  <TableCell>{tx.txHash}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-elegant mb-4">Структура портфеля</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocation} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                  {allocation.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={['#34d399', '#38bdf8', '#a78bfa', '#f59e0b'][index % 4]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    background: 'rgba(10, 16, 12, 0.95)',
                    border: '1px solid rgba(52, 211, 153, 0.2)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="text-2xl font-elegant mb-4">Прогноз дивидендов</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionByMonth}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    background: 'rgba(10, 16, 12, 0.95)',
                    border: '1px solid rgba(52, 211, 153, 0.2)',
                  }}
                />
                <Line type="monotone" dataKey="dividend" stroke="#34d399" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-elegant mb-4">PnL по токенам</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pnlBars}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="token" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    background: 'rgba(10, 16, 12, 0.95)',
                    border: '1px solid rgba(52, 211, 153, 0.2)',
                  }}
                />
                <Bar dataKey="pnl" radius={[8, 8, 0, 0]} fill="#34d399" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
        <Icon size={16} className="text-emerald-400" />
      </div>
      <p className="text-3xl mt-2 font-elegant">{value}</p>
    </Card>
  );
}
