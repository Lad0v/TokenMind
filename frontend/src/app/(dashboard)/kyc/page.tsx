import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';

export default function KycPage() {
  return (
    <div className="space-y-8">
      <section className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] font-tech" style={{ color: 'var(--accent)' }}>
            Verification Center
          </p>
          <h1 className="text-4xl font-elegant leading-tight">KYC Verification</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Подтвердите личность, чтобы получить доступ к claim, tokenization и marketplace операциям.
          </p>
        </div>
        <StatusBadge status="pending" />
      </section>

      <div className="grid xl:grid-cols-[1fr_0.8fr] gap-6">
        <Card>
          <h2 className="text-2xl mb-5 font-elegant">Личные данные</h2>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Имя" placeholder="Иван" />
              <Input label="Фамилия" placeholder="Иванов" />
            </div>
            <Input label="Email" type="email" placeholder="name@company.com" />
            <Input label="Страна" placeholder="Казахстан" />
            <Input label="Номер документа" placeholder="AA1234567" />

            <div className="pt-2 flex gap-3 flex-wrap">
              <Button type="submit">Отправить на проверку</Button>
              <Button variant="outline" type="button">Сохранить как черновик</Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="text-2xl mb-5 font-elegant">Статусы проверки</h2>
          <div className="space-y-4">
            {[
              { label: 'Identity document', status: 'approved' },
              { label: 'Address proof', status: 'pending' },
              { label: 'Face verification', status: 'not_started' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl p-4" style={{ border: '1px solid rgba(52,211,153,0.15)', background: 'rgba(52,211,153,0.03)' }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{item.label}</span>
                  <StatusBadge status={item.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
