"use client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

export type UserRole = "investor" | "issuer" | "admin";

export interface AuthMeResponse {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  status: string;
  verification_status: string | null;
}

export interface WalletAuthResponse {
  access_token: string;
  refresh_token: string;
  role: UserRole;
  is_new_user: boolean;
}

export interface RegisterPayload {
  email: string;
  legal_name?: string;
  country?: string;
}

export interface IpClaim {
  id: string;
  issuer_user_id: string;
  patent_number: string;
  patent_title: string | null;
  claimed_owner_name: string;
  description: string | null;
  jurisdiction: string | null;
  status: string;
  prechecked: boolean;
  precheck_status: string | null;
  source_id: string | null;
  checked_at: string | null;
  patent_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimSnapshot {
  id: string;
  patent_number: string;
  patent_title: string | null;
  claimed_owner_name: string;
  jurisdiction: string | null;
  status: string;
}

export interface AssetListing {
  id: string;
  listing_address: string | null;
  sale_vault_address: string | null;
  platform_treasury_address: string;
  price_per_share_lamports: number;
  remaining_supply: number | null;
  start_ts: string;
  end_ts: string;
  platform_fee_bps: number;
  trade_count: number;
  status: "draft" | "active" | "paused" | "closed" | "sold_out" | "failed";
  sync_status: "pending" | "synced" | "failed";
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenizedAsset {
  id: string;
  issuer_user_id: string;
  issuer_wallet_address: string;
  asset_id: string;
  asset_config_address: string | null;
  mint_address: string | null;
  fraction_config_address: string | null;
  total_shares: number;
  sale_supply: number;
  issuer_reserve: number;
  platform_reserve: number;
  revoke_mint_authority_requested: boolean;
  mint_authority_revoked: boolean;
  status:
    | "draft"
    | "asset_initialized"
    | "minted"
    | "mint_authority_revoked"
    | "fraction_configured"
    | "sale_supply_deposited"
    | "fraction_model_locked"
    | "listed"
    | "paused"
    | "closed"
    | "failed";
  last_completed_operation:
    | "initialize_asset"
    | "mint_asset_tokens"
    | "revoke_mint_authority"
    | "configure_fractionalization"
    | "deposit_sale_supply"
    | "lock_fraction_model"
    | "create_listing"
    | "buy_shares"
    | "pause_listing"
    | "close_listing"
    | null;
  sync_status: "pending" | "synced" | "failed";
  last_error: string | null;
  claim: ClaimSnapshot;
  listing: AssetListing | null;
  created_at: string;
  updated_at: string;
}

export interface BlockchainContext {
  network: string;
  program_id: string;
  platform_treasury_address: string;
  rpc_url: string;
  commitment: string;
}

export interface BlockchainTransaction {
  id: string;
  operation:
    | "initialize_asset"
    | "mint_asset_tokens"
    | "revoke_mint_authority"
    | "configure_fractionalization"
    | "deposit_sale_supply"
    | "lock_fraction_model"
    | "create_listing"
    | "buy_shares"
    | "pause_listing"
    | "close_listing";
  status: "prepared" | "submitted" | "confirmed" | "failed";
  wallet_address: string;
  client_request_id: string | null;
  tx_signature: string | null;
  trade_receipt_address: string | null;
  trade_index: number | null;
  quantity: number | null;
  gross_amount_lamports: number | null;
  fee_amount_lamports: number | null;
  net_amount_lamports: number | null;
  error_message: string | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  created_at: string;
}

export interface TokenizationPrepareResponse {
  tokenization: TokenizedAsset;
  context: BlockchainContext;
  steps: Array<BlockchainTransaction["operation"]>;
  revoke_mint_authority_after_mint: boolean;
}

export interface TokenizationTransactionResponse {
  tokenization: TokenizedAsset;
  transaction: BlockchainTransaction;
  context: BlockchainContext;
}

export interface ListingPrepareResponse {
  tokenization: TokenizedAsset;
  listing: AssetListing;
  transaction: BlockchainTransaction;
  context: BlockchainContext;
}

export interface ListingActionResponse {
  listing: AssetListing;
  transaction: BlockchainTransaction;
  context: BlockchainContext;
}

export interface PurchasePrepareResponse {
  listing: AssetListing;
  transaction: BlockchainTransaction;
  context: BlockchainContext;
}

export interface PurchaseTransactionResponse {
  listing: AssetListing;
  transaction: BlockchainTransaction;
  context: BlockchainContext;
}

export interface MarketplaceListing {
  listing: AssetListing;
  tokenization: TokenizedAsset;
  issuer_name: string | null;
}

export interface PortfolioHolding {
  tokenization_id: string;
  asset_name: string;
  patent_number: string;
  quantity: number;
  average_price_lamports: number;
  current_price_lamports: number | null;
  invested_lamports: number;
  current_value_lamports: number | null;
  listing_status: AssetListing["status"] | null;
  mint_address: string | null;
}

export interface TradeHistoryItem {
  transaction: BlockchainTransaction;
  asset_name: string;
  patent_number: string;
  mint_address: string | null;
}

type RequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
};

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const payload = await response.json();
      detail = typeof payload.detail === "string" ? payload.detail : JSON.stringify(payload.detail ?? payload);
    } catch {
      detail = response.statusText || detail;
    }
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<T>;
}

export function buildClientRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const apiClient = {
  getCurrentUser(token: string) {
    return apiRequest<AuthMeResponse>("/api/v1/auth/me", { token });
  },
  registerInvestor(payload: RegisterPayload & { walletAddress: string }) {
    return apiRequest<{ message: string }>("/api/v1/auth/register", {
      method: "POST",
      body: {
        email: payload.email,
        solana_wallet_address: payload.walletAddress,
        role: "investor",
        legal_name: payload.legal_name,
        country: payload.country,
      },
    });
  },
  loginWithWallet(walletAddress: string) {
    return apiRequest<WalletAuthResponse>("/api/v1/auth/login/wallet", {
      method: "POST",
      body: {
        wallet_address: walletAddress,
        network: "solana",
      },
    });
  },
  listIpClaims(token: string) {
    return apiRequest<{ total: number; items: IpClaim[] }>("/api/v1/ip-claims", { token });
  },
  getIpClaim(token: string, claimId: string) {
    return apiRequest<IpClaim>(`/api/v1/ip-claims/${claimId}`, { token });
  },
  listTokenizations(token: string) {
    return apiRequest<{ items: TokenizedAsset[] }>("/api/v1/blockchain/tokenizations", { token });
  },
  getTokenization(token: string, tokenizationId: string) {
    return apiRequest<TokenizedAsset>(`/api/v1/blockchain/tokenizations/${tokenizationId}`, { token });
  },
  prepareTokenization(
    token: string,
    payload: {
      claim_id: string;
      total_shares: number;
      sale_supply: number;
      issuer_reserve: number;
      platform_reserve: number;
      revoke_mint_authority: boolean;
    },
  ) {
    return apiRequest<TokenizationPrepareResponse>("/api/v1/blockchain/tokenizations/prepare", {
      method: "POST",
      token,
      body: payload,
    });
  },
  submitTokenizationStep(
    token: string,
    tokenizationId: string,
    operation: BlockchainTransaction["operation"],
    payload: Record<string, unknown>,
  ) {
    return apiRequest<TokenizationTransactionResponse>(
      `/api/v1/blockchain/tokenizations/${tokenizationId}/steps/${operation}/submit`,
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },
  prepareListing(token: string, tokenizationId: string, payload: Record<string, unknown>) {
    return apiRequest<ListingPrepareResponse>(
      `/api/v1/blockchain/tokenizations/${tokenizationId}/listing/prepare`,
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },
  submitListing(token: string, tokenizationId: string, payload: Record<string, unknown>) {
    return apiRequest<ListingPrepareResponse>(
      `/api/v1/blockchain/tokenizations/${tokenizationId}/listing/submit`,
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },
  prepareListingAction(
    token: string,
    listingId: string,
    action: "pause" | "close",
    payload: Record<string, unknown>,
  ) {
    return apiRequest<ListingActionResponse>(
      `/api/v1/blockchain/listings/${listingId}/${action}/prepare`,
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },
  submitListingAction(
    token: string,
    listingId: string,
    action: "pause" | "close",
    payload: Record<string, unknown>,
  ) {
    return apiRequest<ListingActionResponse>(
      `/api/v1/blockchain/listings/${listingId}/${action}/submit`,
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },
  listMarketplace(search?: string) {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    return apiRequest<{ items: MarketplaceListing[] }>(`/api/v1/blockchain/marketplace/listings${query}`);
  },
  getMarketplaceListing(listingId: string) {
    return apiRequest<MarketplaceListing>(`/api/v1/blockchain/marketplace/listings/${listingId}`);
  },
  preparePurchase(token: string, listingId: string, payload: Record<string, unknown>) {
    return apiRequest<PurchasePrepareResponse>(
      `/api/v1/blockchain/listings/${listingId}/purchase/prepare`,
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },
  submitPurchase(token: string, purchaseId: string, payload: Record<string, unknown>) {
    return apiRequest<PurchaseTransactionResponse>(
      `/api/v1/blockchain/purchases/${purchaseId}/submit`,
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },
  getPortfolioHoldings(token: string) {
    return apiRequest<{ items: PortfolioHolding[] }>("/api/v1/blockchain/portfolio/holdings", { token });
  },
  getPortfolioTrades(token: string) {
    return apiRequest<{ items: TradeHistoryItem[] }>("/api/v1/blockchain/portfolio/trades", { token });
  },
};
