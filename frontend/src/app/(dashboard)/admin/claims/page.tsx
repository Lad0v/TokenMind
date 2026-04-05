import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';

const claimRows = [
  { id: 'CLM-1009', asset: 'NanoSeal Patent', issuer: 'Synthex Labs', score: '92', status: 'under_review' },
  { id: 'CLM-1014', asset: 'BioInk Formula', issuer: 'Helix Form', score: '88', status: 'prechecked' },
  { id: 'CLM-1030', asset: 'LensAI Patent', issuer: 'Optix Labs', score: '79', status: 'needs_input' },
];

export default function AdminClaimsPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.22em] font-tech" style={{ color: 'var(--accent)' }}>
          Admin · IP Review
        </p>
        <h1 className="text-4xl font-elegant">IP Claims Moderation</h1>
      </section>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Claim ID</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Issuer</TableHead>
              <TableHead>Pre-check score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Decision</TableHead>
            </TableRow>
          </TableHeader>
          <tbody>
            {claimRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.id}</TableCell>
                <TableCell>{row.asset}</TableCell>
                <TableCell>{row.issuer}</TableCell>
                <TableCell>{row.score}</TableCell>
                <TableCell><StatusBadge status={row.status} /></TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button className="!h-9 !px-3">Approve</Button>
                    <Button className="!h-9 !px-3" variant="outline">Need docs</Button>
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
