use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::{
    constants::{ASSET_SEED, FRACTION_SEED, LISTING_SEED, VAULT_AUTH_SEED},
    errors::TokenizationError,
    state::{AssetConfig, FractionConfig, ListingState},
};

#[derive(Accounts)]
#[instruction(asset_id: String)]
pub struct CreateListing<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,
    #[account(
        seeds = [ASSET_SEED, asset_config.issuer.as_ref(), asset_id.as_bytes()],
        bump = asset_config.asset_bump,
        constraint = asset_config.issuer == issuer.key() @ TokenizationError::UnauthorizedIssuer,
    )]
    pub asset_config: Account<'info, AssetConfig>,
    #[account(
        seeds = [FRACTION_SEED, asset_config.key().as_ref()],
        bump = fraction_config.bump,
    )]
    pub fraction_config: Account<'info, FractionConfig>,
    #[account(
        init,
        payer = issuer,
        space = ListingState::SPACE,
        seeds = [LISTING_SEED, fraction_config.key().as_ref()],
        bump,
    )]
    pub listing: Account<'info, ListingState>,
    #[account(
        associated_token::mint = mint,
        associated_token::authority = vault_authority,
    )]
    pub sale_vault: Account<'info, TokenAccount>,
    #[account(seeds = [VAULT_AUTH_SEED, fraction_config.key().as_ref()], bump)]
    /// CHECK: PDA used as sale vault authority.
    pub vault_authority: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    /// CHECK: Treasury can be any system account.
    pub platform_treasury: UncheckedAccount<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateListing>,
    _asset_id: String,
    price_per_share_lamports: u64,
    start_ts: i64,
    end_ts: i64,
    platform_fee_bps: u16,
) -> Result<()> {
    let asset = &ctx.accounts.asset_config;
    let fraction = &ctx.accounts.fraction_config;
    let listing = &mut ctx.accounts.listing;

    require!(asset.is_minted, TokenizationError::AssetNotMinted);
    require!(fraction.sale_deposited, TokenizationError::SaleNotDeposited);
    require!(fraction.is_locked, TokenizationError::FractionNotLocked);
    require!(price_per_share_lamports > 0, TokenizationError::InvalidPrice);
    require!(start_ts < end_ts, TokenizationError::InvalidTimeWindow);
    require!(platform_fee_bps <= 10_000, TokenizationError::InvalidFeeBps);

    require_keys_eq!(fraction.asset, asset.key(), TokenizationError::InvalidFractionConfig);
    require_keys_eq!(fraction.issuer, ctx.accounts.issuer.key(), TokenizationError::UnauthorizedIssuer);
    require_keys_eq!(fraction.mint, ctx.accounts.mint.key(), TokenizationError::InvalidMint);
    require_keys_eq!(asset.mint, ctx.accounts.mint.key(), TokenizationError::InvalidMint);

    listing.asset = asset.key();
    listing.fraction_config = fraction.key();
    listing.issuer = ctx.accounts.issuer.key();
    listing.mint = ctx.accounts.mint.key();
    listing.sale_vault = ctx.accounts.sale_vault.key();
    listing.platform_treasury = ctx.accounts.platform_treasury.key();
    listing.price_per_share_lamports = price_per_share_lamports;
    listing.remaining_supply = fraction.sale_supply;
    listing.start_ts = start_ts;
    listing.end_ts = end_ts;
    listing.platform_fee_bps = platform_fee_bps;
    listing.trade_count = 0;
    listing.is_active = true;
    listing.bump = ctx.bumps.listing;

    Ok(())
}
