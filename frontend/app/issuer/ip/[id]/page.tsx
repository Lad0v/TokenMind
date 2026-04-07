"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  PauseCircle,
  PlayCircle,
  Shield,
  Wallet,
  XCircle,
} from "lucide-react";

import { Header } from "@/components/user/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, buildClientRequestId, IpClaim, TokenizedAsset } from "@/lib/api-client";
import { formatDateTime, lamportsToSol } from "@/lib/format";
import {
  executeCloseListing,
  executeConfigureFractionalization,
  executeCreateListing,
  executeDepositSaleSupply,
  executeInitializeAsset,
  executeLockFractionModel,
  executeMintAssetTokens,
  executePauseListing,
  executeRevokeMintAuthority,
} from "@/lib/solana/tokenization";
import { useAuth } from "@/hooks/use-auth";

const lifecycleSteps = [
  "initialize_asset",
  "mint_asset_tokens",
  "revoke_mint_authority",
  "configure_fractionalization",
  "deposit_sale_supply",
  "lock_fraction_model",
] as const;

export default function IssuerClaimTokenizationPage() {
  const params = useParams<{ id: string }>();
  const claimId = params.id;
  const { user, accessToken, walletAddress, connectWallet, isReady } = useAuth();

  const [claim, setClaim] = useState<IpClaim | null>(null);
  const [tokenization, setTokenization] = useState<TokenizedAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [config, setConfig] = useState({
    totalShares: 1000,
    saleSupply: 600,
    issuerReserve: 300,
    platformReserve: 100,
    revokeMintAuthority: true,
  });
  const [listingConfig, setListingConfig] = useState({
    pricePerShareLamports: 250_000_000,
    startTs: new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16),
    endTs: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    platformFeeBps: 250,
  });

  useEffect(() => {
    if (!isReady || !accessToken || user?.role !== "issuer") {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [claimResponse, tokenizationsResponse] = await Promise.all([
          apiClient.getIpClaim(accessToken, claimId),
          apiClient.listTokenizations(accessToken),
        ]);
        setClaim(claimResponse);
        setTokenization(tokenizationsResponse.items.find((item) => item.claim.id === claimId) ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить claim");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [accessToken, claimId, isReady, user?.role]);

  const nextLifecycleOperation = useMemo(() => {
    if (!tokenization) {
      return null;
    }
    switch (tokenization.status) {
      case "draft":
        return "initialize_asset";
      case "asset_initialized":
        return "mint_asset_tokens";
      case "minted":
        return tokenization.revoke_mint_authority_requested && !tokenization.mint_authority_revoked
          ? "revoke_mint_authority"
          : "configure_fractionalization";
      case "mint_authority_revoked":
        return "configure_fractionalization";
      case "fraction_configured":
        return "deposit_sale_supply";
      case "sale_supply_deposited":
        return "lock_fraction_model";
      default:
        return null;
    }
  }, [tokenization]);

  const refreshTokenization = async () => {
    if (!accessToken || !claimId) {
      return;
    }
    const [claimResponse, tokenizationsResponse] = await Promise.all([
      apiClient.getIpClaim(accessToken, claimId),
      apiClient.listTokenizations(accessToken),
    ]);
    setClaim(claimResponse);
    setTokenization(tokenizationsResponse.items.find((item) => item.claim.id === claimId) ?? null);
  };

  const handlePrepareTokenization = async () => {
    if (!accessToken || !claim) {
      return;
    }
    setActionLoading("prepare");
    setError(null);
    try {
      const response = await apiClient.prepareTokenization(accessToken, {
        claim_id: claim.id,
        total_shares: config.totalShares,
        sale_supply: config.saleSupply,
        issuer_reserve: config.issuerReserve,
        platform_reserve: config.platformReserve,
        revoke_mint_authority: config.revokeMintAuthority,
      });
      setTokenization(response.tokenization);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось подготовить tokenization");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunLifecycleStep = async () => {
    if (!accessToken || !tokenization || !nextLifecycleOperation) {
      return;
    }
    setActionLoading(nextLifecycleOperation);
    setError(null);
    try {
      const activeWallet = walletAddress ?? (await connectWallet());
      let execution: Record<string, unknown>;

      if (nextLifecycleOperation === "initialize_asset") {
        execution = await executeInitializeAsset({
          assetId: tokenization.asset_id,
          totalShares: tokenization.total_shares,
          saleSupply: tokenization.sale_supply,
        });
      } else if (nextLifecycleOperation === "mint_asset_tokens") {
        execution = await executeMintAssetTokens(tokenization);
      } else if (nextLifecycleOperation === "revoke_mint_authority") {
        execution = await executeRevokeMintAuthority(tokenization);
      } else if (nextLifecycleOperation === "configure_fractionalization") {
        execution = await executeConfigureFractionalization(tokenization);
      } else if (nextLifecycleOperation === "deposit_sale_supply") {
        execution = await executeDepositSaleSupply(tokenization);
      } else {
        execution = await executeLockFractionModel(tokenization);
      }

      const response = await apiClient.submitTokenizationStep(
        accessToken,
        tokenization.id,
        nextLifecycleOperation,
        {
          tx_signature: execution.signature,
          wallet_address: activeWallet,
          asset_config_address: execution.assetConfigAddress,
          mint_address: execution.mintAddress,
          fraction_config_address: execution.fractionConfigAddress,
          sale_vault_address: execution.saleVaultAddress,
        },
      );
      setTokenization(response.tokenization);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить on-chain step");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateListing = async () => {
    if (!accessToken || !tokenization) {
      return;
    }
    setActionLoading("create_listing");
    setError(null);
    try {
      const activeWallet = walletAddress ?? (await connectWallet());
      const prepared = await apiClient.prepareListing(accessToken, tokenization.id, {
        client_request_id: buildClientRequestId(),
        price_per_share_lamports: listingConfig.pricePerShareLamports,
        start_ts: new Date(listingConfig.startTs).toISOString(),
        end_ts: new Date(listingConfig.endTs).toISOString(),
        platform_fee_bps: listingConfig.platformFeeBps,
      });
      const execution = await executeCreateListing(prepared.tokenization, prepared.listing);
      const submitted = await apiClient.submitListing(accessToken, tokenization.id, {
        tx_signature: execution.signature,
        wallet_address: activeWallet,
        listing_address: execution.listingAddress,
        sale_vault_address: execution.saleVaultAddress,
      });
      setTokenization(submitted.tokenization);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать listing");
    } finally {
      setActionLoading(null);
    }
  };

  const handleListingAction = async (action: "pause" | "close") => {
    if (!accessToken || !tokenization?.listing) {
      return;
    }
    setActionLoading(action);
    setError(null);
    try {
      const activeWallet = walletAddress ?? (await connectWallet());
      const prepared = await apiClient.prepareListingAction(accessToken, tokenization.listing.id, action, {
        client_request_id: buildClientRequestId(),
      });
      const execution =
        action === "pause"
          ? await executePauseListing(prepared.listing, tokenization)
          : await executeCloseListing(prepared.listing, tokenization);
      await apiClient.submitListingAction(accessToken, tokenization.listing.id, action, {
        tx_signature: execution.signature,
        wallet_address: activeWallet,
        listing_address: execution.listingAddress,
      });
      await refreshTokenization();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Не удалось выполнить ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isReady || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 lg:px-8 py-24">
          <div className="rounded-xl border border-border bg-card/50 p-8 text-center text-muted-foreground">
            Загрузка claim и blockchain state...
          </div>
        </main>
      </div>
    );
  }

  if (!user || user.role !== "issuer" || !accessToken) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 lg:px-8 py-24">
          <div className="rounded-xl border border-border bg-card/50 p-8 text-center text-muted-foreground">
            Этот экран доступен только авторизованным issuers.
          </div>
        </main>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 lg:px-8 py-24">
          <div className="rounded-xl border border-border bg-card/50 p-8 text-center text-muted-foreground">
            Claim не найден.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 lg:px-8 py-8 mt-20">
        <div className="max-w-5xl mx-auto">
          <Link href="/issuer" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="h-4 w-4" />
            Назад в кабинет
          </Link>

          <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-6">
            <section className="space-y-6">
              <div className="rounded-2xl border border-border bg-card/50 p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{claim.patent_number}</p>
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                      {claim.patent_title ?? "Без названия"}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Claim status: <span className="text-foreground">{claim.status}</span>
                    </p>
                  </div>
                  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                    {tokenization ? tokenization.status : "off-chain only"}
                  </Badge>
                </div>

                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <Info label="Правообладатель" value={claim.claimed_owner_name} />
                  <Info label="Юрисдикция" value={claim.jurisdiction ?? "—"} />
                  <Info label="Создано" value={formatDateTime(claim.created_at)} />
                  <Info label="Обновлено" value={formatDateTime(claim.updated_at)} />
                </div>

                {claim.description && (
                  <div className="mt-4 rounded-xl bg-secondary/30 p-4 text-sm text-muted-foreground">
                    {claim.description}
                  </div>
                )}
              </div>

              {!tokenization && (
                <div className="rounded-2xl border border-border bg-card/50 p-6">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Подготовка tokenization</h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Total shares" value={config.totalShares} onChange={(value) => setConfig((current) => ({ ...current, totalShares: value }))} />
                    <Field label="Sale supply" value={config.saleSupply} onChange={(value) => setConfig((current) => ({ ...current, saleSupply: value }))} />
                    <Field label="Issuer reserve" value={config.issuerReserve} onChange={(value) => setConfig((current) => ({ ...current, issuerReserve: value }))} />
                    <Field label="Platform reserve" value={config.platformReserve} onChange={(value) => setConfig((current) => ({ ...current, platformReserve: value }))} />
                  </div>
                  <label className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={config.revokeMintAuthority}
                      onChange={(event) => setConfig((current) => ({ ...current, revokeMintAuthority: event.target.checked }))}
                    />
                    Выполнить `revoke_mint_authority` после mint
                  </label>
                  <Button className="mt-6" onClick={() => void handlePrepareTokenization()} disabled={actionLoading === "prepare" || claim.status !== "approved"}>
                    {actionLoading === "prepare" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Подготовить on-chain lifecycle
                  </Button>
                </div>
              )}

              {tokenization && (
                <div className="rounded-2xl border border-border bg-card/50 p-6">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Lifecycle</h2>
                  <div className="space-y-3">
                    {lifecycleSteps.map((step) => {
                      const isCompleted = tokenization.last_completed_operation === step || lifecycleSteps.indexOf(step) < lifecycleSteps.indexOf((tokenization.last_completed_operation as typeof lifecycleSteps[number]) ?? "initialize_asset");
                      const isCurrent = nextLifecycleOperation === step;
                      const isOptionalSkip = step === "revoke_mint_authority" && !tokenization.revoke_mint_authority_requested;
                      return (
                        <div key={step} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/40 p-4">
                          <div>
                            <p className="font-medium text-foreground">{step}</p>
                            <p className="text-xs text-muted-foreground">
                              {isOptionalSkip ? "Step skipped by issuer configuration" : isCompleted ? "Confirmed in backend mirror" : isCurrent ? "Ready to execute" : "Waiting for previous steps"}
                            </p>
                          </div>
                          {isOptionalSkip ? (
                            <Badge variant="outline">Skipped</Badge>
                          ) : isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          ) : isCurrent ? (
                            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10">Next</Badge>
                          ) : (
                            <Clock className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {nextLifecycleOperation && (
                    <Button className="mt-6" onClick={() => void handleRunLifecycleStep()} disabled={actionLoading === nextLifecycleOperation}>
                      {actionLoading === nextLifecycleOperation ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Выполнить {nextLifecycleOperation}
                    </Button>
                  )}
                </div>
              )}
            </section>

            <aside className="space-y-6">
              {error && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="rounded-2xl border border-border bg-card/50 p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Blockchain mirror</h2>
                <div className="space-y-3 text-sm">
                  <Info label="Wallet" value={walletAddress ?? "Не подключен"} />
                  <Info label="Asset ID" value={tokenization?.asset_id ?? "—"} />
                  <Info label="AssetConfig PDA" value={tokenization?.asset_config_address ?? "—"} mono />
                  <Info label="Mint" value={tokenization?.mint_address ?? "—"} mono />
                  <Info label="FractionConfig PDA" value={tokenization?.fraction_config_address ?? "—"} mono />
                  <Info label="Last operation" value={tokenization?.last_completed_operation ?? "—"} />
                </div>
              </div>

              {tokenization?.status === "fraction_model_locked" && !tokenization.listing && (
                <div className="rounded-2xl border border-border bg-card/50 p-6">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Create listing</h2>
                  <div className="space-y-4">
                    <Field
                      label="Цена за share (lamports)"
                      value={listingConfig.pricePerShareLamports}
                      onChange={(value) => setListingConfig((current) => ({ ...current, pricePerShareLamports: value }))}
                    />
                    <DateField
                      label="Старт продаж"
                      value={listingConfig.startTs}
                      onChange={(value) => setListingConfig((current) => ({ ...current, startTs: value }))}
                    />
                    <DateField
                      label="Конец продаж"
                      value={listingConfig.endTs}
                      onChange={(value) => setListingConfig((current) => ({ ...current, endTs: value }))}
                    />
                    <Field
                      label="Platform fee (bps)"
                      value={listingConfig.platformFeeBps}
                      onChange={(value) => setListingConfig((current) => ({ ...current, platformFeeBps: value }))}
                    />
                    <Button className="w-full" onClick={() => void handleCreateListing()} disabled={actionLoading === "create_listing"}>
                      {actionLoading === "create_listing" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Create listing
                    </Button>
                  </div>
                </div>
              )}

              {tokenization?.listing && (
                <div className="rounded-2xl border border-border bg-card/50 p-6">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <h2 className="text-xl font-semibold text-foreground">Listing</h2>
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                      {tokenization.listing.status}
                    </Badge>
                  </div>
                  <div className="space-y-3 text-sm">
                    <Info label="Listing PDA" value={tokenization.listing.listing_address ?? "—"} mono />
                    <Info label="Sale vault" value={tokenization.listing.sale_vault_address ?? "—"} mono />
                    <Info label="Price / share" value={`${lamportsToSol(tokenization.listing.price_per_share_lamports)} SOL`} />
                    <Info label="Remaining supply" value={String(tokenization.listing.remaining_supply ?? "—")} />
                    <Info label="Sale window" value={`${formatDateTime(tokenization.listing.start_ts)} → ${formatDateTime(tokenization.listing.end_ts)}`} />
                  </div>

                  <div className="mt-6 flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => void handleListingAction("pause")}
                      disabled={tokenization.listing.status !== "active" || actionLoading === "pause"}
                    >
                      {actionLoading === "pause" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PauseCircle className="h-4 w-4 mr-2" />}
                      Pause
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => void handleListingAction("close")}
                      disabled={actionLoading === "close"}
                    >
                      {actionLoading === "close" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                      Close
                    </Button>
                  </div>
                </div>
              )}

              {!walletAddress && (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
                  <div className="flex items-start gap-3">
                    <Wallet className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Подключите Phantom</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Подписывать on-chain инструкции может только wallet, привязанный к аккаунту issuer.
                      </p>
                      <Button variant="outline" onClick={() => void connectWallet()}>
                        Подключить кошелёк
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </aside>
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
    <div className="rounded-xl bg-secondary/30 p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={mono ? "font-mono text-xs break-all text-foreground" : "text-sm text-foreground"}>{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
