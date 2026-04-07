"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Header } from "@/components/user/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, buildClientRequestId, MarketplaceListing } from "@/lib/api-client";
import { formatDate, formatDateTime, lamportsToSol, shortenAddress } from "@/lib/format";
import { executeBuyShares } from "@/lib/solana/tokenization";
import { useAuth } from "@/hooks/use-auth";

export default function ListingDetailPage() {
  const params = useParams<{ listingId: string }>();
  const listingId = params.listingId;
  const { user, accessToken, walletAddress, connectWallet, isReady } = useAuth();

  const [listingData, setListingData] = useState<MarketplaceListing | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.getMarketplaceListing(listingId);
        setListingData(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить listing");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [listingId]);

  const handleBuy = async () => {
    if (!listingData || !accessToken) {
      return;
    }
    setIsPurchasing(true);
    setPurchaseError(null);
    try {
      const activeWallet = walletAddress ?? (await connectWallet());
      const prepared = await apiClient.preparePurchase(accessToken, listingData.listing.id, {
        client_request_id: buildClientRequestId(),
        qty: quantity,
      });
      const execution = await executeBuyShares({
        listing: prepared.listing,
        tokenization: listingData.tokenization,
        quantity,
      });
      await apiClient.submitPurchase(accessToken, prepared.transaction.id, {
        tx_signature: execution.signature,
        wallet_address: activeWallet,
        trade_receipt_address: execution.tradeReceiptAddress,
        trade_index: execution.tradeIndex,
      });
      const refreshed = await apiClient.getMarketplaceListing(listingId);
      setListingData(refreshed);
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : "Покупка завершилась с ошибкой");
    } finally {
      setIsPurchasing(false);
    }
  };

  if (isLoading || !isReady) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 lg:px-8 py-24">
          <div className="rounded-xl border border-border bg-card/50 p-8 text-center text-muted-foreground">
            Загрузка listing...
          </div>
        </main>
      </div>
    );
  }

  if (!listingData || error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 lg:px-8 py-24">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-8 text-center text-destructive">
            {error ?? "Listing не найден"}
          </div>
        </main>
      </div>
    );
  }

  const { listing, tokenization } = listingData;
  const totalCostLamports = quantity * listing.price_per_share_lamports;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 lg:px-8 py-8 mt-20">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" />
          Назад к маркетплейсу
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-xl border border-border bg-card/50">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
                    {listing.status}
                  </Badge>
                  <Badge variant="secondary">Primary sale</Badge>
                </div>
                <Badge variant="outline">{tokenization.status}</Badge>
              </div>

              <p className="text-sm text-muted-foreground mb-2">{tokenization.claim.patent_number}</p>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-4">
                {tokenization.claim.patent_title ?? tokenization.claim.patent_number}
              </h1>

              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <div className="inline-flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  <span>{listingData.issuer_name ?? tokenization.claim.claimed_owner_name}</span>
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <div>Jurisdiction: {tokenization.claim.jurisdiction ?? "—"}</div>
                <div>Window ends: {formatDateTime(listing.end_ts)}</div>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card/50">
              <h2 className="text-lg font-semibold text-foreground mb-4">On-chain details</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Info label="Asset ID" value={tokenization.asset_id} mono />
                <Info label="Mint" value={tokenization.mint_address ?? "—"} mono />
                <Info label="Listing PDA" value={listing.listing_address ?? "—"} mono />
                <Info label="Sale vault" value={listing.sale_vault_address ?? "—"} mono />
                <Info label="Treasury" value={listing.platform_treasury_address} mono />
                <Info label="Created" value={formatDate(tokenization.created_at)} />
              </div>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card/50">
              <h2 className="text-lg font-semibold text-foreground mb-4">Supply</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Info label="Sale supply" value={String(tokenization.sale_supply)} />
                <Info label="Remaining supply" value={String(listing.remaining_supply ?? "—")} />
                <Info label="Issuer reserve" value={String(tokenization.issuer_reserve)} />
                <Info label="Platform reserve" value={String(tokenization.platform_reserve)} />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-6 rounded-xl border border-primary/30 bg-card/50 sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">Цена за share</p>
                  <p className="text-3xl font-bold text-primary">
                    {lamportsToSol(listing.price_per_share_lamports)} <span className="text-lg">SOL</span>
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Доступно</span>
                  <span className="text-foreground font-medium">
                    {listing.remaining_supply ?? "—"} / {tokenization.sale_supply}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${((listing.remaining_supply ?? 0) / tokenization.sale_supply) * 100}%` }}
                  />
                </div>
              </div>

              {user?.role === "investor" && accessToken ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Количество shares</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min={1}
                      max={listing.remaining_supply ?? undefined}
                      value={quantity}
                      onChange={(event) => setQuantity(Number(event.target.value))}
                    />
                  </div>

                  <div className="p-4 rounded-lg bg-secondary/30">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Итого</span>
                      <span className="text-lg font-semibold text-foreground">
                        {lamportsToSol(totalCostLamports)} SOL
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
                    <p className="font-medium text-foreground mb-1">Wallet</p>
                    <p className="text-muted-foreground">{shortenAddress(walletAddress)}</p>
                  </div>

                  {purchaseError && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {purchaseError}
                    </div>
                  )}

                  <Button
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                    onClick={() => void handleBuy()}
                    disabled={isPurchasing || quantity <= 0}
                  >
                    {isPurchasing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Купить shares
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                    <div className="flex items-start gap-3">
                      <Wallet className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground mb-1">Investor login required</p>
                        <p className="text-xs text-muted-foreground">
                          Покупки доступны только авторизованным investor-аккаунтам с привязанным кошельком.
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button asChild className="w-full h-12">
                    <Link href="/auth/login">Войти для покупки</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Info({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="p-4 rounded-lg bg-secondary/30">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={mono ? "text-xs font-mono break-all text-foreground" : "text-sm text-foreground"}>{value}</p>
    </div>
  );
}
