export interface WalletState {
  connected: boolean;
  address: string;
  network: 'Solana Mainnet' | 'Solana Devnet';
  balanceSOL: number;
}

export interface ProfileStats {
  totalEarnedSOL: number;
  claimableSOL: number;
  monthlyYieldPct: number;
  followers: number;
  copiedStrategies: number;
}

export interface TokenHolding {
  id: string;
  asset: string;
  quantity: number;
  avgBuyPriceSOL: number;
  marketPriceSOL: number;
  projectedDividendSOL: number;
  buybackWindow: string;
  status: 'active' | 'tokenized' | 'pending_compliance';
}

export interface TokenTransaction {
  id: string;
  tokenId: string;
  action: 'buy' | 'buyback' | 'dividend';
  amountSOL: number;
  date: string;
  txHash: string;
}

export const earningsSeries = [
  { day: 'Mon', earned: 2.6 },
  { day: 'Tue', earned: 3.1 },
  { day: 'Wed', earned: 2.9 },
  { day: 'Thu', earned: 3.8 },
  { day: 'Fri', earned: 4.4 },
  { day: 'Sat', earned: 4.0 },
  { day: 'Sun', earned: 4.9 },
];

export const initialWalletState: WalletState = {
  connected: true,
  address: '9UQe...4mXk',
  network: 'Solana Mainnet',
  balanceSOL: 126.43,
};

export const initialProfileStats: ProfileStats = {
  totalEarnedSOL: 84.7,
  claimableSOL: 6.23,
  monthlyYieldPct: 11.9,
  followers: 128,
  copiedStrategies: 9,
};

export const initialTokenHoldings: TokenHolding[] = [
  {
    id: 'TKN-310',
    asset: 'NanoSeal Patent',
    quantity: 190,
    avgBuyPriceSOL: 0.41,
    marketPriceSOL: 0.52,
    projectedDividendSOL: 8.6,
    buybackWindow: '10 Apr - 20 Apr',
    status: 'active',
  },
  {
    id: 'TKN-442',
    asset: 'BioInk Formula',
    quantity: 120,
    avgBuyPriceSOL: 0.36,
    marketPriceSOL: 0.47,
    projectedDividendSOL: 5.1,
    buybackWindow: '14 Apr - 25 Apr',
    status: 'tokenized',
  },
  {
    id: 'TKN-578',
    asset: 'Photon Core',
    quantity: 60,
    avgBuyPriceSOL: 0.88,
    marketPriceSOL: 0.95,
    projectedDividendSOL: 3.4,
    buybackWindow: '05 May - 15 May',
    status: 'pending_compliance',
  },
];

export const initialTokenTransactions: TokenTransaction[] = [
  {
    id: 'tx-1',
    tokenId: 'TKN-310',
    action: 'buy',
    amountSOL: 18.2,
    date: '2026-04-03 14:26',
    txHash: '6Tn7...P4kD',
  },
  {
    id: 'tx-2',
    tokenId: 'TKN-442',
    action: 'buyback',
    amountSOL: 6.5,
    date: '2026-04-02 11:08',
    txHash: '3Bc9...sWQ2',
  },
  {
    id: 'tx-3',
    tokenId: 'TKN-310',
    action: 'dividend',
    amountSOL: 2.1,
    date: '2026-04-01 18:44',
    txHash: '8Qm1...lNe9',
  },
  {
    id: 'tx-4',
    tokenId: 'TKN-578',
    action: 'buy',
    amountSOL: 7.9,
    date: '2026-03-30 09:12',
    txHash: '9Ld2...aaT3',
  },
];

export function pulseProfileStats(prev: ProfileStats): ProfileStats {
  return {
    ...prev,
    totalEarnedSOL: Number((prev.totalEarnedSOL + Math.random() * 0.34).toFixed(2)),
    claimableSOL: Number((prev.claimableSOL + Math.random() * 0.08).toFixed(2)),
    followers: prev.followers + (Math.random() > 0.78 ? 1 : 0),
  };
}

export function pulseWalletBalance(prev: WalletState): WalletState {
  return {
    ...prev,
    balanceSOL: Number((prev.balanceSOL + (Math.random() - 0.35) * 0.2).toFixed(2)),
  };
}

export function pulseTokenHoldings(prev: TokenHolding[]): TokenHolding[] {
  return prev.map((holding) => {
    const marketDelta = (Math.random() - 0.48) * 0.03;
    const dividendDelta = Math.random() * 0.05;

    return {
      ...holding,
      marketPriceSOL: Number(Math.max(0.1, holding.marketPriceSOL + marketDelta).toFixed(3)),
      projectedDividendSOL: Number((holding.projectedDividendSOL + dividendDelta).toFixed(2)),
    };
  });
}