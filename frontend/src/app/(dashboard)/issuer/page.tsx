import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';

const claims = [
  { id: 'CLM-1009', asset: 'NanoSeal Patent', stage: 'under_review', updated: '02 Apr 2026' },
  { id: 'CLM-1014', asset: 'BioInk Formula', stage: 'approved_for_tokenization', updated: '01 Apr 2026' },
  { id: 'CLM-1022', asset: 'Photon Engine', stage: 'draft', updated: '31 Mar 2026' },
];

export default function IssuerDashboardPage() {
  return (
    <div className="space-y-8">
      <section className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] font-tech" style={{ color: 'var(--accent)' }}>
            Issuer Portal
          </p>
          <h1 className="text-4xl font-elegant">IP Claims Dashboard</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Подавайте patent claims, отслеживайте review и запускайте tokenization после approval.
          </p>
        </div>
        <Link href="/issuer/claims/new">
          <Button>+ Новый claim</Button>
        </Link>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {[
          { label: 'Всего claims', value: '24' },
          { label: 'Под review', value: '7' },
          { label: 'Готовы к mint', value: '4' },
        ].map((metric) => (
          <Card key={metric.label}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{metric.label}</p>
            <p className="text-3xl mt-2 font-elegant">{metric.value}</p>
          </Card>
        ))}
      </section>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-elegant">Последние заявки</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Актив</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Обновлено</TableHead>
              <TableHead>Действие</TableHead>
            </TableRow>
          </TableHeader>
          <tbody>
            {claims.map((claim) => (
              <TableRow key={claim.id}>
                <TableCell className="font-medium">{claim.id}</TableCell>
                <TableCell>{claim.asset}</TableCell>
                <TableCell><StatusBadge status={claim.stage} /></TableCell>
                <TableCell>{claim.updated}</TableCell>
                <TableCell>
                  <Link className="text-emerald-400 hover:text-emerald-300" href={`/issuer/claims/${claim.id}`}>
                    Открыть
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
