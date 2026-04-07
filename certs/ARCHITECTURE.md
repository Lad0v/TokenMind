# Tokenization Contracts — Project Architecture

## Overview

`tokenization_contracts` is an Anchor program for RWA-style asset tokenization on Solana with fixed-supply SPL shares and primary sale listing.

Core flow:
1. Register asset config.
2. Mint fixed supply (decimals = 0) to issuer.
3. Configure fractional allocation.
4. Deposit sale supply to vault.
5. Lock fraction model.
6. Create listing.
7. Execute purchases (`buy_shares`) with SOL settlement and on-chain trade receipts.

Program ID:
- `4XeEJCxc1TLRaFzyfjYjELPdExY1imRAqiZqjuRqz6Kt`

Declared in:
- `programs/tokenization_contracts/src/lib.rs`
- `Anchor.toml` (`[programs.localnet].tokenization_contracts`)

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Smart Contract | Rust + Anchor | Anchor 0.32.1 |
| Rust Toolchain | Rust | 1.89.0 (edition 2021) |
| Token Libraries | anchor-spl + spl-token | 0.32.1 + 8 |
| Tests | TypeScript + Mocha + Chai | `@coral-xyz/anchor` ^0.32.1 |
| Package Manager | Yarn | from `Anchor.toml` |

Source of truth:
- `programs/tokenization_contracts/Cargo.toml`
- `package.json`
- `rust-toolchain.toml`

## Actual Directory Structure

```text
tokenization_contracts/
├── Anchor.toml
├── Cargo.toml
├── Cargo.lock
├── rust-toolchain.toml
├── package.json
├── tsconfig.json
├── PROJECT_DOCS.md
├── migrations/
│   └── deploy.ts
├── tests/
│   └── tokenization_contracts.ts
└── programs/
    └── tokenization_contracts/
        ├── Cargo.toml
        └── src/
            ├── lib.rs
            ├── constants.rs
            ├── errors.rs
            ├── state/
            │   ├── mod.rs
            │   ├── asset.rs
            │   ├── fraction.rs
            │   └── listing.rs
            └── instructions/
                ├── mod.rs
                ├── initialize_asset.rs
                ├── mint_asset_tokens.rs
                ├── revoke_mint_authority.rs
                ├── configure_fractionalization.rs
                ├── deposit_sale_supply.rs
                ├── lock_fraction_model.rs
                ├── create_listing.rs
                ├── buy_shares.rs
                ├── pause_listing.rs
                └── close_listing.rs
```

Note:
- The on-chain implementation lives in `programs/tokenization_contracts/src/`.
- There are no root-level mirror `.rs` instruction/state files in the current codebase.

## State Accounts (On-Chain)

### 1. `AssetConfig`
PDA:
- `[b"asset", issuer_pubkey, asset_id_bytes]`

Fields:
- `asset_id: String` (max 32 bytes in validation)
- `issuer: Pubkey`
- `mint: Pubkey`
- `total_shares: u64`
- `minted_supply: u64`
- `sale_supply: u64`
- `mint_bump: u8`
- `asset_bump: u8`
- `is_minted: bool`

Space constant:
- `8 + (4 + 32) + 32 + 32 + 8 + 8 + 8 + 1 + 1 + 1 = 135 bytes`

### 2. `FractionConfig`
PDA:
- `[b"fraction", asset_config_pubkey]`

Fields:
- `asset: Pubkey`
- `issuer: Pubkey`
- `mint: Pubkey`
- `total_shares: u64`
- `sale_supply: u64`
- `issuer_reserve: u64`
- `platform_reserve: u64`
- `sale_deposited: bool`
- `is_locked: bool`
- `bump: u8`

Space constant:
- `8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 1 = 139 bytes`

Invariant:
- `sale_supply + issuer_reserve + platform_reserve == total_shares`

### 3. `ListingState`
PDA:
- `[b"listing", fraction_config_pubkey]`

Fields:
- `asset: Pubkey`
- `fraction_config: Pubkey`
- `issuer: Pubkey`
- `mint: Pubkey`
- `sale_vault: Pubkey`
- `platform_treasury: Pubkey`
- `price_per_share_lamports: u64`
- `remaining_supply: u64`
- `start_ts: i64`
- `end_ts: i64`
- `platform_fee_bps: u16`
- `trade_count: u64`
- `is_active: bool`
- `bump: u8`

Space constant:
- `8 + (32 * 6) + 8 + 8 + 8 + 8 + 2 + 8 + 1 + 1 = 244 bytes`

### 4. `TradeReceipt`
PDA:
- `[b"trade", listing_pubkey, trade_index_le_u64]`

Fields:
- `listing: Pubkey`
- `buyer: Pubkey`
- `issuer: Pubkey`
- `mint: Pubkey`
- `qty: u64`
- `unit_price_lamports: u64`
- `gross_amount_lamports: u64`
- `fee_amount_lamports: u64`
- `net_amount_lamports: u64`
- `trade_index: u64`
- `timestamp: i64`
- `bump: u8`

Space constant:
- `8 + (32 * 4) + (8 * 7) + 1 = 193 bytes`

## PDA Seeds & Authorities

| PDA / Address | Seeds | Purpose |
|---|---|---|
| `AssetConfig` | `[asset, issuer, asset_id]` | Asset metadata and mint lifecycle |
| `MintAuth` | `[mint-auth, asset_config]` | Program signer for mint and mint authority revoke |
| `FractionConfig` | `[fraction, asset_config]` | Allocation model |
| `VaultAuth` | `[vault-auth, fraction_config]` | Owner authority of sale vault ATA |
| `ListingState` | `[listing, fraction_config]` | Single listing state for a fraction config |
| `TradeReceipt` | `[trade, listing, trade_index_le]` | Sequential trade records |

## Instruction Lifecycle

### Asset tokenization
1. `initialize_asset(asset_id, total_shares, sale_supply)`
   - Checks: `asset_id.len() <= 32`, `total_shares > 0`, `sale_supply <= total_shares`.
2. `mint_asset_tokens(asset_id)`
   - Initializes mint with `decimals = 0`, `authority = MintAuth PDA`.
   - Mints `total_shares` to issuer ATA.
   - Sets `is_minted = true`, stores mint pubkey and mint bump.
3. `revoke_mint_authority(asset_id)` (optional)
   - Calls `set_authority(MintTokens, None)` via `MintAuth` PDA.

### Fraction setup
4. `configure_fractionalization(asset_id, sale_supply, issuer_reserve, platform_reserve)`
   - Requires minted asset.
   - Requires `sale_supply > 0`.
   - Requires allocation sum equals `total_shares`.
   - Reconfiguration is allowed only when not locked and not deposited.
5. `deposit_sale_supply(asset_id)`
   - Transfers `sale_supply` tokens issuer ATA -> sale vault ATA (owned by `VaultAuth` PDA).
   - Sets `sale_deposited = true`.
6. `lock_fraction_model(asset_id)`
   - Requires `sale_deposited == true`.
   - Sets `is_locked = true` (irreversible in current program logic).

### Listing and buying
7. `create_listing(asset_id, price_per_share_lamports, start_ts, end_ts, platform_fee_bps)`
   - Requires minted asset, deposited sale, locked fraction model.
   - Checks: `price > 0`, `start_ts < end_ts`, `platform_fee_bps <= 10_000`.
   - Initializes listing with `remaining_supply = fraction.sale_supply` and `is_active = true`.
8. `buy_shares(qty)`
   - Requires active listing and current time in `[start_ts, end_ts]`.
   - Checks `qty > 0` and `qty <= remaining_supply`.
   - Computes:
     - `gross = qty * unit_price`
     - `fee = gross * fee_bps / 10_000` (u128 intermediate)
     - `net = gross - fee`
   - Transfers SOL: buyer -> issuer (`net`) and buyer -> treasury (`fee`, if > 0).
   - Transfers tokens: vault -> buyer ATA via `VaultAuth` PDA signer.
   - Creates `TradeReceipt` at trade index `listing.trade_count`.
   - Updates `remaining_supply` and `trade_count`.
   - Auto-sets `is_active = false` on sellout.
9. `pause_listing()` / `close_listing()`
   - Issuer only.
   - `pause_listing`: requires currently active listing.
   - `close_listing`: force-sets inactive without extra preconditions.

## Error Codes (`TokenizationError`)

- `AssetIdTooLong`
- `InvalidTotalShares`
- `InvalidSaleSupply`
- `AlreadyMinted`
- `InvalidMint`
- `UnauthorizedIssuer`
- `AssetNotMinted`
- `InvalidFractionAllocation`
- `InvalidFractionConfig`
- `SaleAlreadyDeposited`
- `SaleNotDeposited`
- `FractionModelLocked`
- `FractionNotLocked`
- `InvalidPrice`
- `InvalidTimeWindow`
- `InvalidFeeBps`
- `ListingInactive`
- `InvalidQty`
- `InsufficientListingSupply`
- `ListingOutsideWindow`
- `InvalidListingAccount`
- `MathOverflow`

Defined in:
- `programs/tokenization_contracts/src/errors.rs`

## Security Model (Implemented)

- Issuer authorization constraints on all issuer-only flows.
- PDA-controlled mint authority and explicit revoke path.
- Vault custody through PDA authority (`VaultAuth`), no direct issuer withdrawal instruction.
- Time-window validation in `buy_shares`.
- Checked arithmetic (`checked_*`) with u128 fee math.
- One-time sale deposit guard (`sale_deposited`).
- Lock-based immutability of fraction config (`is_locked`).
- Account-key validation in `buy_shares` for issuer, treasury, mint, and sale vault.

## Test Coverage (Current `tests/tokenization_contracts.ts`)

File length:
- 1046 lines

Covered:
1. Asset create -> mint fixed supply -> revoke mint authority.
2. Invalid init input (`total_shares = 0`, `sale_supply > total_shares`).
3. Non-issuer rejection for mint/revoke.
4. Fraction config + deposit + lock happy path.
5. Reconfigure blocked after lock.
6. Configure before mint rejected.
7. Fraction allocation invariant checks (`sale_supply = 0`, sum mismatch).
8. Deposit/lock ordering and second-deposit rejection.
9. Non-issuer rejection for configure/deposit/lock.
10. Listing create + buy settlement + receipt amount checks.
11. Auto-deactivation on full sellout.
12. Invalid listing window rejection.
13. Invalid buy quantities (`qty = 0`, `qty > remaining_supply`).
14. Non-issuer rejection for pause/close.
15. Buy rejected on inactive listing after pause.

Not explicitly covered by tests right now:
- `InvalidPrice`
- `InvalidFeeBps`
- `ListingOutsideWindow`
- `InvalidListingAccount`

## Build & Test Commands

From `tokenization_contracts/`:

```bash
anchor build
anchor test
yarn run ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"
yarn lint
yarn lint:fix
```

If using an external validator:

```bash
solana-test-validator --reset
anchor test --skip-local-validator
```

## Module Layout

Program entrypoint:
- `programs/tokenization_contracts/src/lib.rs`

State:
- `programs/tokenization_contracts/src/state/asset.rs`
- `programs/tokenization_contracts/src/state/fraction.rs`
- `programs/tokenization_contracts/src/state/listing.rs`

Instructions:
- `programs/tokenization_contracts/src/instructions/initialize_asset.rs`
- `programs/tokenization_contracts/src/instructions/mint_asset_tokens.rs`
- `programs/tokenization_contracts/src/instructions/revoke_mint_authority.rs`
- `programs/tokenization_contracts/src/instructions/configure_fractionalization.rs`
- `programs/tokenization_contracts/src/instructions/deposit_sale_supply.rs`
- `programs/tokenization_contracts/src/instructions/lock_fraction_model.rs`
- `programs/tokenization_contracts/src/instructions/create_listing.rs`
- `programs/tokenization_contracts/src/instructions/buy_shares.rs`
- `programs/tokenization_contracts/src/instructions/pause_listing.rs`
- `programs/tokenization_contracts/src/instructions/close_listing.rs`

Constants and errors:
- `programs/tokenization_contracts/src/constants.rs`
- `programs/tokenization_contracts/src/errors.rs`
