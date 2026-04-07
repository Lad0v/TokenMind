# Blockchain Integration

This project now integrates the Anchor/Solana module in [certs/ARCHITECTURE.md](/home/nikcnn/Work/TokenMind/certs/ARCHITECTURE.md) through a wallet-signed, backend-validated flow.

For the full implementation walkthrough, file inventory, verification checklist, and local run details, see [INTEGRATION_IMPLEMENTATION_DETAILS.md](/home/nikcnn/Work/TokenMind/INTEGRATION_IMPLEMENTATION_DETAILS.md).

## Design boundary

- User wallets sign the actual Solana instructions.
- The backend owns business validation, auth/KYC gating, intent preparation, off-chain mirroring, audit logging, and on-chain status sync.
- Sensitive KYC, documents, and review payloads stay off-chain.
- The on-chain lifecycle remains the contract source of truth:
  - `initialize_asset`
  - `mint_asset_tokens`
  - `revoke_mint_authority`
  - `configure_fractionalization`
  - `deposit_sale_supply`
  - `lock_fraction_model`
  - `create_listing`
  - `buy_shares`
  - `pause_listing`
  - `close_listing`

## Backend architecture

- New mirror models live in [backend/app/models/blockchain.py](/home/nikcnn/Work/TokenMind/backend/app/models/blockchain.py).
- Solana RPC/account decoding lives in [backend/app/blockchain/client.py](/home/nikcnn/Work/TokenMind/backend/app/blockchain/client.py).
- Service boundary:
  - [backend/app/services/tokenization_service.py](/home/nikcnn/Work/TokenMind/backend/app/services/tokenization_service.py)
  - [backend/app/services/listing_service.py](/home/nikcnn/Work/TokenMind/backend/app/services/listing_service.py)
  - [backend/app/services/purchase_service.py](/home/nikcnn/Work/TokenMind/backend/app/services/purchase_service.py)
  - [backend/app/services/blockchain_sync_service.py](/home/nikcnn/Work/TokenMind/backend/app/services/blockchain_sync_service.py)
  - [backend/app/services/blockchain_access_service.py](/home/nikcnn/Work/TokenMind/backend/app/services/blockchain_access_service.py)
- API surface lives in [backend/app/api/v1/endpoints/blockchain.py](/home/nikcnn/Work/TokenMind/backend/app/api/v1/endpoints/blockchain.py).

## Stored off-chain mirror state

- `tokenized_assets`
  - links approved `IpClaim` -> issuer -> wallet -> asset_id -> PDAs/mint -> lifecycle status
- `asset_listings`
  - mirrors `ListingState` with pricing, supply, time window, treasury, and sync state
- `blockchain_transactions`
  - stores prepared/submitted/confirmed/failed lifecycle actions, receipts, signatures, and quantity/amount metadata

These tables are intentionally minimal. They store enough to rebuild UI state, audit critical actions, and recover from partial failures without duplicating all on-chain state.

## API flow

Issuer:

1. `POST /api/v1/blockchain/tokenizations/prepare`
2. `POST /api/v1/blockchain/tokenizations/{id}/steps/{operation}/submit`
3. `POST /api/v1/blockchain/tokenizations/{id}/listing/prepare`
4. `POST /api/v1/blockchain/tokenizations/{id}/listing/submit`
5. `POST /api/v1/blockchain/listings/{id}/pause/prepare|submit`
6. `POST /api/v1/blockchain/listings/{id}/close/prepare|submit`

Investor:

1. `GET /api/v1/blockchain/marketplace/listings`
2. `GET /api/v1/blockchain/marketplace/listings/{id}`
3. `POST /api/v1/blockchain/listings/{id}/purchase/prepare`
4. `POST /api/v1/blockchain/purchases/{id}/submit`
5. `GET /api/v1/blockchain/portfolio/holdings`
6. `GET /api/v1/blockchain/portfolio/trades`

Example purchase prepare request:

```json
{
  "client_request_id": "5fca30d2-0f76-4bfc-a31b-0319e12c0870",
  "qty": 25
}
```

Example tokenization submit request:

```json
{
  "tx_signature": "5x...signature...",
  "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "asset_config_address": "9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "mint_address": "DxKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
}
```

## Frontend integration points

- Shared auth/session state: [frontend/components/providers/auth-provider.tsx](/home/nikcnn/Work/TokenMind/frontend/components/providers/auth-provider.tsx)
- Backend client: [frontend/lib/api-client.ts](/home/nikcnn/Work/TokenMind/frontend/lib/api-client.ts)
- Wallet + transaction builders:
  - [frontend/lib/solana/provider.ts](/home/nikcnn/Work/TokenMind/frontend/lib/solana/provider.ts)
  - [frontend/lib/solana/tokenization.ts](/home/nikcnn/Work/TokenMind/frontend/lib/solana/tokenization.ts)
- Main UI consumers:
  - [frontend/app/issuer/page.tsx](/home/nikcnn/Work/TokenMind/frontend/app/issuer/page.tsx)
  - [frontend/app/issuer/ip/[id]/page.tsx](/home/nikcnn/Work/TokenMind/frontend/app/issuer/ip/[id]/page.tsx)
  - [frontend/app/marketplace/page.tsx](/home/nikcnn/Work/TokenMind/frontend/app/marketplace/page.tsx)
  - [frontend/app/marketplace/[listingId]/page.tsx](/home/nikcnn/Work/TokenMind/frontend/app/marketplace/[listingId]/page.tsx)
  - [frontend/app/investor/portfolio/page.tsx](/home/nikcnn/Work/TokenMind/frontend/app/investor/portfolio/page.tsx)

## Local setup

1. Copy [.env.example](/home/nikcnn/Work/TokenMind/.env.example) to `.env`.
2. Start a local validator on the host:

```bash
solana-test-validator --reset
```

3. Keep the validator reachable from Docker through `host.docker.internal:8899`.
4. Build and run the platform:

```bash
docker compose up --build
```

5. Open:
  - frontend: `http://localhost:3000`
  - api docs: `http://localhost:8000/docs`

## Notes and limitations

- The repository does not contain a full historical Alembic baseline. The new migration creates blockchain tables, and local Docker bootstrap also calls `Base.metadata.create_all()` after Alembic so a clean local database is still runnable.
- The frontend assumes an injected Phantom-compatible wallet.
- The frontend now depends on `@solana/web3.js`; Docker installs frontend dependencies with `npm install` so the lockfile mismatch in this environment does not block builds.
- `pause_listing` and `close_listing` both set `is_active = false` on-chain, so the backend distinguishes them by the last confirmed off-chain operation.
- Purchase eligibility currently enforces investor role, active account, wallet presence, and rejects non-approved KYC/verification cases when such cases exist.
