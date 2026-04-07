import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';

const assets = [
  { id: 'AST-301', name: 'NanoSeal Patent', issuer: 'Synthex Labs', allocation: '12.5%', price: '84 SOL', status: 'active' },
  { id: 'AST-302', name: 'BioInk Formula', issuer: 'Helix Form', allocation: '7.2%', price: '55 SOL', status: 'tokenized' },
  { id: 'AST-303', name: 'Photon Compression Core', issuer: 'QubitEdge', allocation: '18.1%', price: '110 SOL', status: 'active' },
  { id: 'AST-304', name: 'Quantum Print Stack', issuer: 'PrintNova', allocation: '9.4%', price: '67 SOL', status: 'approved' },
];

export default function InvestorMarketplacePage() {
  return (
    <div className="space-y-8">
      <section className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] font-tech" style={{ color: 'var(--accent)' }}>
            Investor Space
          </p>
          <h1 className="text-4xl font-elegant">IP Marketplace</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Инвестируйте в верифицированные IP-активы с прозрачным статусом review и mint.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline">Музыка</Button>
          <Button variant="outline">Патенты</Button>
          <Button variant="outline">Бренды</Button>
        </div>
      </section>

      <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {assets.map((asset) => (
          <Card key={asset.id} interactive>
            <div className="flex items-center justify-between mb-3">
              <StatusBadge status={asset.status} />
              <span className="text-xs font-tech" style={{ color: 'var(--text-muted)' }}>{asset.id}</span>
            </div>
            <h2 className="text-xl font-semibold mb-1">{asset.name}</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Issuer: {asset.issuer}</p>
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <MiniStat label="Allocation" value={asset.allocation} />
              <MiniStat label="Min ticket" value={asset.price} />
            </div>
            <Button fullWidth>Инвестировать</Button>
          </Card>
        ))}
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)' }}>
      <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
