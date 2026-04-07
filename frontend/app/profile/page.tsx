'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Coins,
  RefreshCcw,
  ShieldCheck,
  User2,
  Wallet,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentUser, useIpClaims, useUserProfile, useVerificationStatus } from '@/hooks/use-api';
import { useWallet, useWalletBalance } from '@/hooks/use-wallet';
import { getUserFriendlyErrorMessage } from '@/lib/error-handler';
import { formatWalletAddress } from '@/lib/wallet-helper';
import type { IpClaim } from '@/types/api';

const ACTIVE_CLAIM_STATUSES = new Set(['submitted', 'prechecked', 'under_review']);

function statusBadge(status: string) {
  if (status === 'approved' || status === 'active') return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  if (status === 'rejected' || status === 'blocked') return 'text-red-300 border-red-500/30 bg-red-500/10';
  return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
}

function buildClaimsActivityData(claims: IpClaim[]) {
  if (!claims.length) {
    return Array.from({ length: 7 }, (_, index) => ({
      day: `D-${6 - index}`,
      claims: 0,
    }));
  }

  const grouped = claims.reduce<Record<string, number>>((acc, claim) => {
    const key = claim.created_at?.slice(0, 10) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, count]) => ({
      day: date === 'unknown' ? 'n/a' : date.slice(5),
      claims: count,
    }));
}

export default function InvestorProfilePage() {
  const { data: currentUser, execute: loadCurrentUser, loading: currentUserLoading } = useCurrentUser();
  const { data: profile, execute: loadProfile, loading: profileLoading } = useUserProfile();
  const { data: claimsData, execute: loadClaims, loading: claimsLoading } = useIpClaims({ skip: 0, limit: 50 });
  const { data: verificationStatus, execute: loadVerificationStatus } = useVerificationStatus();

  const wallet = useWallet();
  const {
    balance: solBalance,
    loading: solBalanceLoading,
    refresh: refreshSolBalance,
  } = useWalletBalance(wallet.walletAddress);

  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const claims = claimsData?.items || [];

  const refreshAll = useCallback(async () => {
    setSyncError(null);
    try {
      await Promise.all([
        loadCurrentUser(),
        loadProfile(),
        loadClaims(),
        loadVerificationStatus().catch(() => null),
        wallet.walletAddress ? refreshSolBalance() : Promise.resolve(),
      ]);
      setLastSync(new Date());
    } catch (error) {
      setSyncError(getUserFriendlyErrorMessage(error));
    }
  }, [
    loadCurrentUser,
    loadProfile,
    loadClaims,
    loadVerificationStatus,
    wallet.walletAddress,
    refreshSolBalance,
  ]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const handleWalletAction = useCallback(async () => {
    try {
      if (wallet.isConnected) {
        await wallet.disconnect();
        return;
      }
      await wallet.connect();
      await refreshSolBalance();
    } catch (error) {
      setSyncError(getUserFriendlyErrorMessage(error));
    }
  }, [wallet, refreshSolBalance]);

  const claimsActivity = useMemo(() => buildClaimsActivityData(claims), [claims]);
  const approvedClaims = claims.filter((claim) => claim.status === 'approved').length;
  const activeClaims = claims.filter((claim) => ACTIVE_CLAIM_STATUSES.has(claim.status)).length;
  const completionPoints = [
    Boolean(currentUser?.email),
    Boolean(profile?.legal_name),
    Boolean(profile?.country),
    wallet.isConnected,
  ].filter(Boolean).length;
  const profileCompletion = Math.round((completionPoints / 4) * 100);

  const globalLoading =
    currentUserLoading || profileLoading || claimsLoading || wallet.isLoading || solBalanceLoading;

  return (
    <div className="space-y-8 pb-28">
      <section className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] font-tech" style={{ color: 'var(--accent)' }}>
            Investor Profile
          </p>
          <h1 className="text-4xl font-elegant">Profile and Wallet</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Live account state from backend and Solana wallet snapshot in one place.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => void refreshAll()} variant="outline" className="gap-2" disabled={globalLoading}>
            <RefreshCcw size={15} className={globalLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <div
            className="text-xs px-3 py-2 rounded-xl border"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
          >
            <span className="inline-flex items-center gap-2">
              <Activity size={14} className="text-emerald-400" />
              Synced: {lastSync ? lastSync.toLocaleTimeString('en-US') : '--:--:--'}
            </span>
          </div>
        </div>
      </section>

      {(syncError || wallet.error) && (
        <Card className="p-4 border-red-500/30 bg-red-500/10">
          <div className="flex items-start gap-3 text-red-200">
            <AlertCircle size={16} className="mt-0.5" />
            <p className="text-sm">{syncError || wallet.error}</p>
          </div>
        </Card>
      )}

      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Profile Completion"
          value={`${profileCompletion}%`}
          note={`${completionPoints}/4 checkpoints`}
          icon={User2}
        />
        <MetricCard
          label="Total Claims"
          value={`${claims.length}`}
          note={`${approvedClaims} approved`}
          icon={ShieldCheck}
        />
        <MetricCard
          label="Active Claims"
          value={`${activeClaims}`}
          note="submitted / prechecked / review"
          icon={Activity}
        />
        <MetricCard
          label="SOL Balance"
          value={wallet.isConnected ? `${(solBalance ?? 0).toFixed(4)} SOL` : 'Not connected'}
          note={wallet.walletAddress ? formatWalletAddress(wallet.walletAddress, 4) : 'Connect Phantom'}
          icon={Coins}
        />
      </section>

      <section className="grid xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 p-6">
          <h2 className="text-2xl font-elegant mb-1">Claims Activity</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Claims created over recent updates.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={claimsActivity}>
                <defs>
                  <linearGradient id="claimsActivityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    background: 'rgba(10, 16, 12, 0.95)',
                    border: '1px solid rgba(52, 211, 153, 0.2)',
                  }}
                />
                <Area type="monotone" dataKey="claims" stroke="#34d399" fill="url(#claimsActivityGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-elegant mb-4">Account Snapshot</h2>
          <div className="space-y-3 text-sm">
            <InfoRow label="Role" value={currentUser?.role || 'n/a'} />
            <InfoRow label="Status" value={currentUser?.status || 'n/a'} />
            <InfoRow label="Email" value={currentUser?.email || 'not set'} />
            <InfoRow label="Legal Name" value={profile?.legal_name || 'not set'} />
            <InfoRow label="Country" value={profile?.country || 'not set'} />
            <InfoRow label="Verification" value={verificationStatus?.status || currentUser?.verification_status || 'not_started'} />
          </div>

          <div className="mt-5 flex gap-2">
            <Button onClick={handleWalletAction} className="flex-1 gap-2">
              <Wallet size={15} />
              {wallet.isConnected ? 'Disconnect Wallet' : 'Connect Phantom'}
            </Button>
            <Link href="/investor" className="flex-1">
              <Button variant="outline" className="w-full">
                Investments
              </Button>
            </Link>
          </div>
        </Card>
      </section>

      <section>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-elegant">Recent Claims</h2>
            <Link href="/investor">
              <Button variant="outline" size="sm">
                Open Investments
              </Button>
            </Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patent</TableHead>
                <TableHead>Jurisdiction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                    No claims yet. Submit your first patent to start activity.
                  </TableCell>
                </TableRow>
              )}
              {claims.slice(0, 6).map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell className="font-medium">{claim.patent_title || claim.patent_number}</TableCell>
                  <TableCell>{claim.jurisdiction || 'n/a'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadge(claim.status)}`}>
                      {claim.status}
                    </span>
                  </TableCell>
                  <TableCell>{claim.updated_at?.slice(0, 10) || 'n/a'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="fixed bottom-5 right-5 z-20 w-[min(92vw,320px)]">
        <Card className="p-4 border-emerald-500/20 bg-[rgba(10,18,13,0.92)] backdrop-blur-md">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Live Wallet</p>
            <span className="text-xs text-emerald-300 inline-flex items-center gap-1">
              <CheckCircle2 size={12} />
              {wallet.isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            {wallet.walletAddress ? formatWalletAddress(wallet.walletAddress, 4) : 'Connect Phantom to sync on-chain balance.'}
          </p>
          <p className="text-xl mt-2 font-elegant">
            {wallet.isConnected ? `${(solBalance ?? 0).toFixed(4)} SOL` : '--'}
          </p>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
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
      <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
        {note}
      </p>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
