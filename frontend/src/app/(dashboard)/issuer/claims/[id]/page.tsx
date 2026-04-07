import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';

export default async function IssuerClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="space-y-8">
      <section className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] font-tech" style={{ color: 'var(--accent)' }}>
            Claim Details
          </p>
          <h1 className="text-4xl font-elegant">{id}</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Полная карточка claim с результатами pre-check, review и допуском к tokenization.
          </p>
        </div>
        <StatusBadge status="under_review" />
      </section>

      <div className="grid xl:grid-cols-[1fr_0.9fr] gap-6">
        <Card>
          <h2 className="text-2xl font-elegant mb-4">Claim Summary</h2>
          <dl className="grid md:grid-cols-2 gap-4 text-sm">
            <Info label="Asset name" value="NanoSeal Patent" />
            <Info label="Jurisdiction" value="US" />
            <Info label="Pre-check score" value="92/100" />
            <Info label="Owner" value="Synthex Labs" />
            <Info label="Submitted" value="31 Mar 2026" />
            <Info label="Next step" value="Admin review" />
          </dl>
        </Card>

        <Card>
          <h2 className="text-2xl font-elegant mb-4">Lifecycle</h2>
          <div className="space-y-3 text-sm">
            {[
              'Draft created by issuer',
              'Patent API pre-check completed',
              'Enrichment metadata attached',
              'Forwarded to admin review queue',
            ].map((step, idx) => (
              <div key={step} className="rounded-lg px-3 py-3" style={{ border: '1px solid rgba(52,211,153,0.15)', background: idx === 3 ? 'rgba(234,179,8,0.08)' : 'rgba(52,211,153,0.04)' }}>
                {step}
              </div>
            ))}
          </div>
          <div className="pt-5 flex gap-3 flex-wrap">
            <Button>Запросить статус</Button>
            <Button variant="outline">Скачать отчёт</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.12)' }}>
      <dt className="text-xs uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <dd className="mt-1.5 text-[15px] font-medium">{value}</dd>
    </div>
  );
}
