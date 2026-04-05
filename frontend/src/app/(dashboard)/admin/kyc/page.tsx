import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';

const kycRows = [
  { user: 'A. Beketov', country: 'KZ', level: 'L2', submitted: '02 Apr 2026', status: 'manual_review' },
  { user: 'M. Tanaka', country: 'JP', level: 'L1', submitted: '02 Apr 2026', status: 'pending' },
  { user: 'S. Ivanova', country: 'DE', level: 'L2', submitted: '01 Apr 2026', status: 'needs_input' },
];

export default function AdminKycQueuePage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.22em] font-tech" style={{ color: 'var(--accent)' }}>
          Admin · KYC Queue
        </p>
        <h1 className="text-4xl font-elegant">KYC Review Queue</h1>
      </section>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <tbody>
            {kycRows.map((row) => (
              <TableRow key={`${row.user}-${row.submitted}`}>
                <TableCell className="font-medium">{row.user}</TableCell>
                <TableCell>{row.country}</TableCell>
                <TableCell>{row.level}</TableCell>
                <TableCell>{row.submitted}</TableCell>
                <TableCell><StatusBadge status={row.status} /></TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button className="!h-9 !px-3" variant="outline">Review</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
