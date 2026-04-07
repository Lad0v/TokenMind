'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Coins,
  Layers3,
  RefreshCcw,
  Wallet,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useCurrentUser,
  useIpClaims,
  useMarketplaceCategories,
  useMarketplaceListings,
} from '@/hooks/use-api';
import { useWallet, useWalletBalance } from '@/hooks/use-wallet';
import { getUserFriendlyErrorMessage } from '@/lib/error-handler';
import { formatWalletAddress } from '@/lib/wallet-helper';

const CLAIM_FLOW_STATUSES = ['draft', 'submitted', 'prechecked', 'under_review', 'approved', 'rejected'] as const;

function statusBadge(status: string) {
  if (status === 'approved' || status === 'active') return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  if (status === 'rejected' || status === 'blocked') return 'text-red-300 border-red-500/30 bg-red-500/10';
  return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
}

function parsePriceToSol(price: string) {
  const numeric = Number.parseFloat((price || '').replace(/[^0-9.,-]/g, '').replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : 0;
}

export default function InvestorInvestmentsPage() {
  const { data: currentUser, execute: loadCurrentUser, loading: currentUserLoading } = useCurrentUser();
  const { data: claimsData, execute: loadClaims, loading: claimsLoading } = useIpClaims({ skip: 0, limit: 50 });
  const { data: listingsData, execute: loadListings, loading: listingsLoading } = useMarketplaceListings({
    skip: 0,
    limit: 8,
  });
  const { data: categoriesData, execute: loadCategories } = useMarketplaceCategories();

  const wallet = useWallet();
  const {
    balance: solBalance,
    loading: solBalanceLoading,
    refresh: refreshSolBalance,
  } = useWalletBalance(wallet.walletAddress);

  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const claims = claimsData?.items || [];
  const listings = listingsData?.items || [];
  const categories = categoriesData?.categories || [];

  const refreshAll = useCallback(async () => {
    setSyncError(null);
    try {
      await Promise.all([
        loadCurrentUser(),
        loadClaims(),
        loadListings(),
        loadCategories(),
        wallet.walletAddress ? refreshSolBalance() : Promise.resolve(),
      ]);
      setLastSync(new Date());
    } catch (error) {
      setSyncError(getUserFriendlyErrorMessage(error));
    }
  }, [loadCurrentUser, loadClaims, loadListings, loadCategories, wallet.walletAddress, refreshSolBalance]);

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

  const activeClaims = claims.filter((claim) =>
    ['submitted', 'prechecked', 'under_review'].includes(claim.status)
  ).length;
  const listedValueSol = listings.reduce((sum, listing) => sum + parsePriceToSol(listing.price), 0);

  const flowData = useMemo(() => {
    const counts = claims.reduce<Record<string, number>>((acc, claim) => {
      acc[claim.status] = (acc[claim.status] || 0) + 1;
      return acc;
    }, {});

    return CLAIM_FLOW_STATUSES.map((status) => ({
      status,
      count: counts[status] || 0,
    }));
  }, [claims]);

  const globalLoading =
    currentUserLoading || claimsLoading || listingsLoading || wallet.isLoading || solBalanceLoading;

  return (
    <div className="space-y-8 pb-24">
      <section className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] font-tech" style={{ color: 'var(--accent)' }}>
            Investor Hub
          </p>
          <h1 className="text-4xl font-elegant">Investments and Opportunities</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Connected view of your backend claims, marketplace feed, and Solana wallet.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/profile">
            <Button variant="outline">Profile</Button>
          </Link>
          <Button onClick={() => void refreshAll()} variant="outline" className="gap-2" disabled={globalLoading}>
            <RefreshCcw size={15} className={globalLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <div
            className="text-xs px-3 py-2 rounded-xl border"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
          >
            Synced: {lastSync ? lastSync.toLocaleTimeString('en-US') : '--:--:--'}
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
          label="Wallet SOL"
          value={wallet.isConnected ? `${(solBalance ?? 0).toFixed(4)} SOL` : 'Not connected'}
          note={wallet.walletAddress ? formatWalletAddress(wallet.walletAddress, 4) : 'Phantom disconnected'}
          icon={Wallet}
        />
        <MetricCard
          label="Marketplace Listings"
          value={`${listingsData?.total ?? listings.length}`}
          note={`${categories.length} categories`}
          icon={Layers3}
        />
        <MetricCard
          label="Claim Pipeline"
          value={`${claims.length}`}
          note={`${activeClaims} active now`}
          icon={Activity}
        />
        <MetricCard
          label="Visible SOL Value"
          value={`${listedValueSol.toFixed(2)} SOL`}
          note="sum of current listing prices"
          icon={Coins}
        />
      </section>

      <section className="grid xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-elegant">Marketplace Feed</h2>
            <Link href="/marketplace">
              <Button variant="outline" size="sm">
                Open Marketplace
              </Button>
            </Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Supply</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                    No listings yet from backend.
                  </TableCell>
                </TableRow>
              )}
              {listings.map((listing) => (
                <TableRow key={listing.id}>
                  <TableCell className="font-medium">
                    <Link href={`/marketplace/${listing.id}`} className="hover:underline">
                      {listing.title}
                    </Link>
                  </TableCell>
                  <TableCell>{listing.category}</TableCell>
                  <TableCell>{listing.price}</TableCell>
                  <TableCell>
                    {listing.availableTokens}/{listing.totalTokens}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadge(listing.status)}`}>
                      {listing.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-elegant mb-4">Wallet Control</h2>
          <div className="space-y-3 text-sm">
            <InfoRow label="User" value={currentUser?.email || 'unknown'} />
            <InfoRow label="Role" value={currentUser?.role || 'n/a'} />
            <InfoRow label="Wallet" value={wallet.walletAddress ? formatWalletAddress(wallet.walletAddress, 4) : 'not connected'} />
            <InfoRow label="Network" value="Solana Mainnet" />
            <InfoRow label="Balance" value={wallet.isConnected ? `${(solBalance ?? 0).toFixed(4)} SOL` : '--'} />
          </div>
          <Button onClick={handleWalletAction} className="mt-6 w-full gap-2">
            <Wallet size={15} />
            {wallet.isConnected ? 'Disconnect Wallet' : 'Connect Phantom'}
          </Button>
        </Card>
      </section>

      <section className="grid xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 p-6">
          <h2 className="text-2xl font-elegant mb-2">Claim Status Distribution</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Live distribution from backend `ip-claims`.
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flowData}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="status" />
                <YAxis allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    background: 'rgba(10, 16, 12, 0.95)',
                    border: '1px solid rgba(52, 211, 153, 0.2)',
                  }}
                />
                <Bar dataKey="count" fill="#34d399" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-elegant mb-4">Recent Claim Events</h2>
          <div className="space-y-3">
            {claims.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                No claims yet. Submit a patent to see your workflow here.
              </p>
            )}
            {claims
              .slice()
              .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
              .slice(0, 5)
              .map((claim) => (
                <div
                  key={claim.id}
                  className="rounded-xl border px-3 py-3"
                  style={{ borderColor: 'rgba(52, 211, 153, 0.2)', background: 'rgba(52, 211, 153, 0.05)' }}
                >
                  <p className="text-sm font-medium">{claim.patent_title || claim.patent_number}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Updated {claim.updated_at.slice(0, 10)}
                  </p>
                  <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadge(claim.status)}`}>
                    {claim.status}
                  </span>
                </div>
              ))}
          </div>
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
