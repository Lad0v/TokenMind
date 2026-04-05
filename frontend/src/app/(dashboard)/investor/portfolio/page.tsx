import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';

const holdings = [
  { asset: 'NanoSeal Patent', qty: '190 tokens', avg: '0.41 SOL', value: '95.8 SOL', status: 'active' },
  { asset: 'BioInk Formula', qty: '120 tokens', avg: '0.36 SOL', value: '59.1 SOL', status: 'active' },
  { asset: 'Photon Core', qty: '60 tokens', avg: '0.88 SOL', value: '66.3 SOL', status: 'tokenized' },
];

export default function InvestorPortfolioPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.22em] font-tech" style={{ color: 'var(--accent)' }}>
          Investor Portfolio
        </p>
        <h1 className="text-4xl font-elegant">Мой портфель</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Мониторинг активов, динамики позиций и этапов lifecycle токенизированных IP.
        </p>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {[
          { label: 'Portfolio Value', value: '221.2 SOL' },
          { label: 'Unrealized PnL', value: '+19.4 SOL' },
          { label: 'Assets in portfolio', value: '8' },
        ].map((item) => (
          <Card key={item.label}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.label}</p>
            <p className="text-3xl mt-2 font-elegant">{item.value}</p>
          </Card>
        ))}
      </section>

      <Card>
        <h2 className="text-2xl font-elegant mb-4">Holdings</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Avg. price</TableHead>
              <TableHead>Current value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <tbody>
            {holdings.map((h) => (
              <TableRow key={h.asset}>
                <TableCell className="font-medium">{h.asset}</TableCell>
                <TableCell>{h.qty}</TableCell>
                <TableCell>{h.avg}</TableCell>
                <TableCell>{h.value}</TableCell>
                <TableCell><StatusBadge status={h.status} /></TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
