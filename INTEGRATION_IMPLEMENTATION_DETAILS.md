# Integration Implementation Details

This document explains how the Solana blockchain module from `certs/ARCHITECTURE.md` was integrated into the existing TokenMind web platform, what boundaries were preserved, and how to verify the result locally.

## 1. Scope and design intent

The integration goal was not to rewrite the platform around Solana. The goal was to add a clean blockchain boundary that:

- keeps the existing FastAPI, SQLAlchemy, and Next.js structure intact
- preserves existing auth, KYC, IP claim, patent, and audit-oriented workflows
- mirrors only the minimum on-chain state needed for UI, filtering, recovery, and traceability
- keeps sensitive identity and compliance data off-chain
- follows the exact contract lifecycle defined in `certs/ARCHITECTURE.md`

The authoritative on-chain lifecycle used in the integration is:

1. `initialize_asset`
2. `mint_asset_tokens`
3. `revoke_mint_authority`
4. `configure_fractionalization`
5. `deposit_sale_supply`
6. `lock_fraction_model`
7. `create_listing`
8. `buy_shares`
9. `pause_listing`
10. `close_listing`

No alternative lifecycle was introduced.

## 2. Contract alignment rules used

The integration follows these contract rules directly from `certs/ARCHITECTURE.md`:

- `AssetConfig`, `FractionConfig`, `ListingState`, and `TradeReceipt` are the authoritative on-chain state accounts.
- Issuer and investor wallets sign the actual Solana transactions.
- Token minting uses fixed supply SPL shares with `decimals = 0`.
- Fraction allocation must satisfy:
  - `sale_supply + issuer_reserve + platform_reserve == total_shares`
- Listing creation must respect:
  - `price_per_share_lamports > 0`
  - `start_ts < end_ts`
  - `platform_fee_bps <= 10_000`
- Purchases must respect:
  - active listing
  - current time inside listing window
  - `qty > 0`
  - `qty <= remaining_supply`
- `pause_listing` and `close_listing` are kept as distinct product actions even though both lead to inactive listing state on-chain.

## 3. Architecture decision: wallet-signed, backend-validated

The integration uses a split-responsibility model:

- Frontend wallet signs and submits Solana transactions.
- Backend validates business eligibility and current lifecycle state.
- Backend prepares the intent and mirrors the result off-chain.
- Backend confirms transactions through RPC and refreshes mirrored chain state.

This was chosen to avoid putting a platform hot wallet in the API for normal issuer and investor flows. It also keeps wallet ownership aligned with the existing `WalletLink` model.

The resulting product flow is:

1. Frontend asks backend to prepare an action.
2. Backend checks role, status, ownership, claim/listing eligibility, and idempotency.
3. Frontend builds the Solana instruction using the exact contract instruction name and PDA layout.
4. User wallet signs and sends the transaction.
5. Frontend submits the transaction signature and resulting addresses back to backend.
6. Backend verifies signature status, fetches on-chain account state, updates mirrors, and records audit/trace data.

## 4. Backend integration

### 4.1 New configuration

The backend now exposes explicit blockchain config in `backend/app/core/config.py`:

- `ENABLE_BLOCKCHAIN`
- `SOLANA_NETWORK`
- `SOLANA_RPC_URL`
- `SOLANA_COMMITMENT`
- `SOLANA_PROGRAM_ID`
- `SOLANA_PLATFORM_TREASURY`
- `SOLANA_EXPLORER_BASE_URL`

These values are mirrored in:

- `.env.example`
- `backend/.env.example`
- `docker-compose.yml`

### 4.2 New mirror models

New SQLAlchemy models live in `backend/app/models/blockchain.py`.

#### `TokenizedAsset`

Purpose:

- one off-chain record per tokenized IP claim
- bridges approved `IpClaim` to issuer wallet, asset id, mint, fraction config, and lifecycle status

Important fields:

- `ip_claim_id`
- `issuer_user_id`
- `issuer_wallet_address`
- `asset_id`
- `asset_config_address`
- `mint_address`
- `fraction_config_address`
- `total_shares`
- `sale_supply`
- `issuer_reserve`
- `platform_reserve`
- `revoke_mint_authority_requested`
- `mint_authority_revoked`
- `status`
- `last_completed_operation`
- `sync_status`
- `last_error`
- `metadata_snapshot`
- `chain_snapshot`

#### `AssetListing`

Purpose:

- one off-chain mirror of the primary sale listing for a tokenized asset

Important fields:

- `tokenized_asset_id`
- `listing_address`
- `sale_vault_address`
- `platform_treasury_address`
- `price_per_share_lamports`
- `remaining_supply`
- `start_ts`
- `end_ts`
- `platform_fee_bps`
- `trade_count`
- `status`
- `sync_status`
- `last_error`

#### `BlockchainTransaction`

Purpose:

- operation-level trace of prepared, submitted, confirmed, or failed blockchain actions
- supports replay safety, receipts, auditability, and UI transaction history

Important fields:

- `tokenized_asset_id`
- `listing_id`
- `user_id`
- `operation`
- `status`
- `wallet_address`
- `client_request_id`
- `tx_signature`
- `trade_receipt_address`
- `trade_index`
- `quantity`
- `gross_amount_lamports`
- `fee_amount_lamports`
- `net_amount_lamports`
- `error_message`
- `response_payload`
- `submitted_at`
- `confirmed_at`

Idempotency and replay safety are primarily enforced through unique constraints on:

- `client_request_id`
- `tx_signature`

### 4.3 Migration and database bootstrap

Blockchain mirror tables were added through:

- `backend/alembic/versions/20260407_0001_blockchain_integration.py`

Because the repository does not contain a full historical Alembic baseline, local startup was also made more resilient in:

- `backend/scripts/entrypoint.sh`

After Alembic runs, the backend now calls the metadata bootstrap path so local development can still create missing tables on a clean database.

This is a practical local-development fallback, not a replacement for a proper production migration history.

### 4.4 Solana integration layer

A dedicated blockchain boundary was added instead of spreading Solana logic across existing business modules.

#### `backend/app/blockchain/client.py`

This file contains:

- JSON-RPC calls through `httpx`
- transaction signature status lookup
- account fetch and decode helpers for:
  - `AssetConfig`
  - `FractionConfig`
  - `ListingState`
  - `TradeReceipt`
- lightweight base58 and binary decoding needed for account parsing

This keeps Anchor/Solana protocol details out of unrelated services.

#### `backend/app/blockchain/dependencies.py`

This file provides the injectable blockchain client dependency for API endpoints and tests.

### 4.5 Service boundary

The backend business boundary is split into dedicated services.

#### `backend/app/services/blockchain_access_service.py`

Responsibilities:

- resolves wallet ownership through existing user wallet links
- checks issuer/investor access to blockchain actions
- preserves role-based eligibility without rewriting auth

#### `backend/app/services/blockchain_sync_service.py`

Responsibilities:

- confirms submitted transactions through the RPC client
- refreshes on-chain account state into mirror tables
- maps chain state to product-friendly statuses
- stores sync errors explicitly instead of swallowing them

#### `backend/app/services/tokenization_service.py`

Responsibilities:

- prepare tokenization draft
- validate issuer, wallet, claim ownership, and eligibility
- enforce contract sequence across:
  - `initialize_asset`
  - `mint_asset_tokens`
  - `revoke_mint_authority`
  - `configure_fractionalization`
  - `deposit_sale_supply`
  - `lock_fraction_model`
- persist asset mirrors and operation records

#### `backend/app/services/listing_service.py`

Responsibilities:

- prepare listing creation
- validate listing window and fee bounds
- submit and sync:
  - `create_listing`
  - `pause_listing`
  - `close_listing`
- mirror listing state changes

#### `backend/app/services/purchase_service.py`

Responsibilities:

- prepare `buy_shares` purchase intents
- enforce investor role and account checks
- prevent invalid purchase quantities
- store trade receipts and portfolio history mirrors

### 4.6 API surface

The new API lives in:

- `backend/app/api/v1/endpoints/blockchain.py`

It was mounted in:

- `backend/app/api/v1/router.py`

The API is intentionally frontend-oriented and avoids leaking Anchor internals as raw backend contracts.

#### Issuer tokenization endpoints

- `GET /api/v1/blockchain/tokenizations`
- `POST /api/v1/blockchain/tokenizations/prepare`
- `GET /api/v1/blockchain/tokenizations/{tokenization_id}`
- `GET /api/v1/blockchain/tokenizations/{tokenization_id}/status`
- `POST /api/v1/blockchain/tokenizations/{tokenization_id}/steps/{operation}/submit`

These endpoints cover preparation, execution submission, and status refresh for the tokenization lifecycle.

#### Listing endpoints

- `POST /api/v1/blockchain/tokenizations/{tokenization_id}/listing/prepare`
- `POST /api/v1/blockchain/tokenizations/{tokenization_id}/listing/submit`
- `POST /api/v1/blockchain/listings/{listing_id}/pause/prepare`
- `POST /api/v1/blockchain/listings/{listing_id}/pause/submit`
- `POST /api/v1/blockchain/listings/{listing_id}/close/prepare`
- `POST /api/v1/blockchain/listings/{listing_id}/close/submit`

#### Marketplace and portfolio endpoints

- `GET /api/v1/blockchain/marketplace/listings`
- `GET /api/v1/blockchain/marketplace/listings/{listing_id}`
- `POST /api/v1/blockchain/listings/{listing_id}/purchase/prepare`
- `POST /api/v1/blockchain/purchases/{transaction_id}/submit`
- `GET /api/v1/blockchain/portfolio/holdings`
- `GET /api/v1/blockchain/portfolio/trades`

### 4.7 Validation and eligibility rules

The integration keeps blockchain actions behind the existing product rules instead of treating Solana as a bypass.

Issuer-side checks include:

- authenticated user must have issuer role
- user must be active
- user must have a linked wallet
- claim must belong to the issuer
- claim must be in an approved/eligible state before tokenization
- lifecycle steps must be submitted in valid sequence

Investor-side checks include:

- authenticated user must have investor role
- user must be active
- user must have a linked wallet
- purchase quantity must be valid
- listing must be active and within its time window
- KYC/verification requirements are preserved through existing user verification records when present

### 4.8 Auditability and error handling

Critical blockchain actions are persisted instead of only returning transient responses.

Recorded details include:

- operation name
- wallet address
- request id
- signature
- quantity and payment amounts for trades
- trade receipt address when available
- sync error or chain confirmation error

Transaction failures are not silently ignored. Failed actions remain visible through mirror state and error fields.

### 4.9 Security boundary preserved

The integration does not move sensitive or review-oriented data on-chain.

The following remain off-chain:

- KYC forms
- documents
- selfies
- video
- manual review notes
- audit payloads
- personal identity details

Only tokenization, listing, and trade state is mirrored against on-chain accounts.

## 5. Frontend integration

### 5.1 Shared auth/session layer

Frontend auth and session state was centralized so blockchain pages do not fetch user state ad hoc.

Added:

- `frontend/components/providers/auth-provider.tsx`
- `frontend/hooks/use-auth.ts`
- `frontend/lib/session.ts`
- `frontend/lib/api-client.ts`

This supports:

- using existing backend auth flows
- storing current user and session token state
- making typed backend requests from feature pages

### 5.2 Wallet transaction layer

The wallet interaction boundary lives in:

- `frontend/lib/solana/provider.ts`
- `frontend/lib/solana/tokenization.ts`

Important implementation details:

- uses `@solana/web3.js`
- assumes an injected Phantom-compatible provider
- derives PDAs according to the contract architecture
- builds raw `TransactionInstruction` payloads using the exact instruction discriminators

The client-side implementation intentionally matches the contract instruction names:

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

This avoided inventing a parallel frontend abstraction that diverges from the contract.

### 5.3 Issuer UI wiring

Real issuer flows were connected in:

- `frontend/app/issuer/page.tsx`
- `frontend/app/issuer/ip/[id]/page.tsx`

The issuer flow now:

1. loads issuer claims and tokenization mirrors from backend
2. prepares tokenization through backend
3. executes each required wallet-signed Solana step
4. submits the signature and resulting addresses back to backend
5. reads back updated status from backend mirrors
6. prepares and creates listing
7. allows pause and close actions for the listing

This replaces mock-only tokenization behavior with a backend-backed lifecycle.

### 5.4 Investor UI wiring

Real investor flows were connected in:

- `frontend/app/marketplace/page.tsx`
- `frontend/app/marketplace/[listingId]/page.tsx`
- `frontend/app/investor/portfolio/page.tsx`

The investor flow now:

1. loads public marketplace listings from backend
2. views individual listing details
3. prepares a purchase with backend validation
4. executes `buy_shares` through the wallet
5. submits signature and receipt details back to backend
6. reads holdings and trade history from portfolio endpoints

### 5.5 Auth pages and shared layout

Updated:

- `frontend/app/auth/login/page.tsx`
- `frontend/app/auth/register/page.tsx`
- `frontend/app/layout.tsx`
- `frontend/components/user/header.tsx`

These changes make wallet-aware auth and role-aware navigation available to the new blockchain-backed routes without replacing the rest of the product structure.

## 6. Infrastructure and local development

### 6.1 Docker wiring

`docker-compose.yml` was updated so frontend and backend can both receive Solana configuration and reach a host validator.

Key additions:

- `host.docker.internal:host-gateway` mapping
- frontend `NEXT_PUBLIC_SOLANA_*` env variables
- backend `SOLANA_*` env variables via existing `.env`

### 6.2 Local validator assumption

The current integration assumes local Solana development uses a validator running on the host:

```bash
solana-test-validator --reset
```

The default RPC URL is:

```text
http://host.docker.internal:8899
```

This keeps the default developer flow simple and avoids forcing a new validator container into the base stack.

### 6.3 Frontend dependency update

The frontend now depends on:

- `@solana/web3.js`

Because `package-lock.json` was not regenerated in this environment, the Docker frontend dependency stage was updated to use `npm install` instead of `npm ci`.

That is a pragmatic local-build fix. A future cleanup should regenerate and commit the lockfile.

## 7. Additional compatibility fix

During the integration, `GET /ip-claims` was tightened so non-admin users do not receive all claims.

Updated:

- `backend/app/api/v1/endpoints/ip_claims.py`
- `backend/app/services/ip_claim_service.py`

This matters because issuer tokenization screens depend on loading only the current issuer's claims, and the original behavior exposed more data than needed.

## 8. Tests and verification added

Added:

- `backend/tests/test_blockchain_integration.py`

Covered cases:

- tokenization preparation creates an off-chain mirror record
- `initialize_asset` submission updates tokenization state when chain data confirms it
- purchase preparation uses listing mirror state correctly

## 9. What was verified in this environment

The following verification was completed in the current workspace environment:

- Python source compilation:
  - `python -m compileall backend/app backend/tests backend/main.py`

This verifies Python syntax across the changed backend code and tests.

The following could not be completed in this environment because required dependencies were not installed:

- `pytest`
- FastAPI runtime boot
- SQLAlchemy-backed integration execution
- frontend typecheck/build using installed project dependencies
- end-to-end Solana transaction execution against a local validator

This means the integration is wired in code, but full runtime verification still needs to be done on a machine or container image with the project dependencies installed.

## 10. How to check whether it works locally

Use the following checklist.

### 10.1 Prepare environment

1. Copy `.env.example` to `.env`.
2. Confirm backend and frontend receive matching Solana values:
   - `SOLANA_RPC_URL`
   - `SOLANA_PROGRAM_ID`
   - `SOLANA_NETWORK`
   - `SOLANA_PLATFORM_TREASURY`
3. Start a local validator on the host:

```bash
solana-test-validator --reset
```

4. Make sure the tokenization program is deployed to that validator and matches `SOLANA_PROGRAM_ID`.

If the program is not deployed to localnet, wallet transactions will fail even though the web integration code is correct.

### 10.2 Start the platform

Run:

```bash
docker compose up --build
```

Open:

- frontend: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`

### 10.3 Backend smoke checks

Check:

- API container starts without import/runtime errors
- new blockchain routes appear in Swagger
- database contains the new tables:
  - `tokenized_assets`
  - `asset_listings`
  - `blockchain_transactions`

### 10.4 Issuer flow verification

1. Register or log in as an issuer with a wallet.
2. Use the existing KYC and IP claim process until the issuer owns an approved claim.
3. Open the issuer claim tokenization page.
4. Prepare tokenization.
5. Execute each wallet step in order:
   - `initialize_asset`
   - `mint_asset_tokens`
   - optional `revoke_mint_authority`
   - `configure_fractionalization`
   - `deposit_sale_supply`
   - `lock_fraction_model`
6. Prepare and submit `create_listing`.
7. Confirm the UI shows updated mirrored status after each step.

Backend/db checks after issuer flow:

- `tokenized_assets.status` should advance with each confirmed step
- `asset_config_address`, `mint_address`, and `fraction_config_address` should be filled
- `asset_listings` should contain listing address and sale window data
- `blockchain_transactions` should contain one row per operation with signature and status

### 10.5 Marketplace and investor verification

1. Log in as an investor with a wallet.
2. Open marketplace list and confirm the issuer listing appears.
3. Open listing detail and submit purchase preparation.
4. Execute wallet purchase for `buy_shares`.
5. Submit transaction back to backend.
6. Confirm:
   - listing remaining supply updates
   - trade count updates
   - portfolio holdings appear
   - trade history shows the purchase

Backend/db checks after investor flow:

- new `buy_shares` transaction exists in `blockchain_transactions`
- trade quantity and amount fields are populated
- trade receipt address is stored when returned
- listing mirror reflects remaining supply and status

### 10.6 Negative-path checks

Also test that the integration rejects invalid behavior:

- issuer without approved claim cannot prepare tokenization
- investor cannot access issuer-only tokenization endpoints
- purchase with invalid quantity fails
- purchase outside listing window fails
- duplicate `client_request_id` does not create duplicate purchase intent
- duplicate `tx_signature` is rejected by unique persistence rules

## 11. Known limitations and follow-up work

- Full end-to-end verification still requires installed backend/frontend dependencies and a deployed local Solana program.
- The repository still lacks a complete historical Alembic migration baseline.
- `package-lock.json` should be regenerated and committed later so frontend Docker builds can return to `npm ci`.
- The frontend currently assumes an injected Phantom-compatible wallet.
- `pause_listing` and `close_listing` both produce inactive on-chain listing state, so the off-chain mirror distinguishes them by the last confirmed operation and stored listing status.

## 12. File map of the main integration work

### Backend

- `backend/app/models/blockchain.py`
- `backend/app/schemas/blockchain.py`
- `backend/app/blockchain/client.py`
- `backend/app/blockchain/dependencies.py`
- `backend/app/services/blockchain_access_service.py`
- `backend/app/services/blockchain_sync_service.py`
- `backend/app/services/tokenization_service.py`
- `backend/app/services/listing_service.py`
- `backend/app/services/purchase_service.py`
- `backend/app/api/v1/endpoints/blockchain.py`
- `backend/alembic/versions/20260407_0001_blockchain_integration.py`

### Frontend

- `frontend/components/providers/auth-provider.tsx`
- `frontend/hooks/use-auth.ts`
- `frontend/lib/api-client.ts`
- `frontend/lib/session.ts`
- `frontend/lib/solana/provider.ts`
- `frontend/lib/solana/tokenization.ts`
- `frontend/app/issuer/page.tsx`
- `frontend/app/issuer/ip/[id]/page.tsx`
- `frontend/app/marketplace/page.tsx`
- `frontend/app/marketplace/[listingId]/page.tsx`
- `frontend/app/investor/portfolio/page.tsx`

### Infrastructure and docs

- `.env.example`
- `backend/.env.example`
- `docker-compose.yml`
- `frontend/Dockerfile`
- `BLOCKCHAIN_INTEGRATION.md`
- this file
