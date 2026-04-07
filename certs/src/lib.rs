use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use crate::instructions::buy_shares::__client_accounts_buy_shares;
use crate::instructions::buy_shares::BuyShares;
use crate::instructions::close_listing::__client_accounts_close_listing;
use crate::instructions::close_listing::CloseListing;
use crate::instructions::configure_fractionalization::__client_accounts_configure_fractionalization;
use crate::instructions::configure_fractionalization::ConfigureFractionalization;
use crate::instructions::create_listing::__client_accounts_create_listing;
use crate::instructions::create_listing::CreateListing;
use crate::instructions::deposit_sale_supply::__client_accounts_deposit_sale_supply;
use crate::instructions::deposit_sale_supply::DepositSaleSupply;
use crate::instructions::initialize_asset::__client_accounts_initialize_asset;
use crate::instructions::initialize_asset::InitializeAsset;
use crate::instructions::lock_fraction_model::__client_accounts_lock_fraction_model;
use crate::instructions::lock_fraction_model::LockFractionModel;
use crate::instructions::mint_asset_tokens::__client_accounts_mint_asset_tokens;
use crate::instructions::mint_asset_tokens::MintAssetTokens;
use crate::instructions::pause_listing::__client_accounts_pause_listing;
use crate::instructions::pause_listing::PauseListing;
use crate::instructions::revoke_mint_authority::__client_accounts_revoke_mint_authority;
use crate::instructions::revoke_mint_authority::RevokeMintAuthority;

declare_id!("4XeEJCxc1TLRaFzyfjYjELPdExY1imRAqiZqjuRqz6Kt");

#[program]
pub mod tokenization_contracts {
    use super::*;

    pub fn initialize_asset(
        ctx: Context<InitializeAsset>,
        asset_id: String,
        total_shares: u64,
        sale_supply: u64,
    ) -> Result<()> {
        crate::instructions::initialize_asset::handler(ctx, asset_id, total_shares, sale_supply)
    }

    pub fn mint_asset_tokens(
        ctx: Context<MintAssetTokens>,
        asset_id: String,
    ) -> Result<()> {
        crate::instructions::mint_asset_tokens::handler(ctx, asset_id)
    }

    pub fn revoke_mint_authority(
        ctx: Context<RevokeMintAuthority>,
        asset_id: String,
    ) -> Result<()> {
        crate::instructions::revoke_mint_authority::handler(ctx, asset_id)
    }

    pub fn configure_fractionalization(
        ctx: Context<ConfigureFractionalization>,
        asset_id: String,
        sale_supply: u64,
        issuer_reserve: u64,
        platform_reserve: u64,
    ) -> Result<()> {
        crate::instructions::configure_fractionalization::handler(
            ctx,
            asset_id,
            sale_supply,
            issuer_reserve,
            platform_reserve,
        )
    }

    pub fn deposit_sale_supply(
        ctx: Context<DepositSaleSupply>,
        asset_id: String,
    ) -> Result<()> {
        crate::instructions::deposit_sale_supply::handler(ctx, asset_id)
    }

    pub fn lock_fraction_model(
        ctx: Context<LockFractionModel>,
        asset_id: String,
    ) -> Result<()> {
        crate::instructions::lock_fraction_model::handler(ctx, asset_id)
    }

    pub fn create_listing(
        ctx: Context<CreateListing>,
        asset_id: String,
        price_per_share_lamports: u64,
        start_ts: i64,
        end_ts: i64,
        platform_fee_bps: u16,
    ) -> Result<()> {
        crate::instructions::create_listing::handler(
            ctx,
            asset_id,
            price_per_share_lamports,
            start_ts,
            end_ts,
            platform_fee_bps,
        )
    }

    pub fn buy_shares(ctx: Context<BuyShares>, qty: u64) -> Result<()> {
        crate::instructions::buy_shares::handler(ctx, qty)
    }

    pub fn pause_listing(ctx: Context<PauseListing>) -> Result<()> {
        crate::instructions::pause_listing::handler(ctx)
    }

    pub fn close_listing(ctx: Context<CloseListing>) -> Result<()> {
        crate::instructions::close_listing::handler(ctx)
    }
}
