import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.22em] font-tech" style={{ color: 'var(--accent)' }}>
          Admin Panel
        </p>
        <h1 className="text-4xl font-elegant">Review Control Center</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Управляйте очередями KYC и IP-review до допуска к tokenization и market listing.
        </p>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {[
          { label: 'KYC Queue', value: '43', status: 'pending' },
          { label: 'IP Claims Review', value: '17', status: 'under_review' },
          { label: 'Approved Today', value: '12', status: 'approved' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{kpi.label}</p>
                <p className="text-3xl mt-2 font-elegant">{kpi.value}</p>
              </div>
              <StatusBadge status={kpi.status} />
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
