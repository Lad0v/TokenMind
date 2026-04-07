use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::{
    constants::{ASSET_SEED, FRACTION_SEED},
    errors::TokenizationError,
    state::{AssetConfig, FractionConfig},
};

#[derive(Accounts)]
#[instruction(asset_id: String)]
pub struct ConfigureFractionalization<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,
    #[account(
        seeds = [ASSET_SEED, asset_config.issuer.as_ref(), asset_id.as_bytes()],
        bump = asset_config.asset_bump,
        constraint = asset_config.issuer == issuer.key() @ TokenizationError::UnauthorizedIssuer,
    )]
    pub asset_config: Account<'info, AssetConfig>,
    #[account(
        init_if_needed,
        payer = issuer,
        space = FractionConfig::SPACE,
        seeds = [FRACTION_SEED, asset_config.key().as_ref()],
        bump,
    )]
    pub fraction_config: Account<'info, FractionConfig>,
    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ConfigureFractionalization>,
    _asset_id: String,
    sale_supply: u64,
    issuer_reserve: u64,
    platform_reserve: u64,
) -> Result<()> {
    let asset_config = &ctx.accounts.asset_config;
    let fraction_config = &mut ctx.accounts.fraction_config;

    require!(asset_config.is_minted, TokenizationError::AssetNotMinted);
    require!(sale_supply > 0, TokenizationError::InvalidSaleSupply);
    require_keys_eq!(
        ctx.accounts.mint.key(),
        asset_config.mint,
        TokenizationError::InvalidMint
    );

    let allocated = sale_supply
        .checked_add(issuer_reserve)
        .and_then(|value| value.checked_add(platform_reserve))
        .ok_or(TokenizationError::InvalidFractionAllocation)?;
    require!(
        allocated == asset_config.total_shares,
        TokenizationError::InvalidFractionAllocation
    );

    if fraction_config.asset != Pubkey::default() {
        require!(!fraction_config.is_locked, TokenizationError::FractionModelLocked);
        require!(
            !fraction_config.sale_deposited,
            TokenizationError::SaleAlreadyDeposited
        );
    }

    fraction_config.asset = asset_config.key();
    fraction_config.issuer = asset_config.issuer;
    fraction_config.mint = asset_config.mint;
    fraction_config.total_shares = asset_config.total_shares;
    fraction_config.sale_supply = sale_supply;
    fraction_config.issuer_reserve = issuer_reserve;
    fraction_config.platform_reserve = platform_reserve;
    fraction_config.sale_deposited = false;
    fraction_config.is_locked = false;
    fraction_config.bump = ctx.bumps.fraction_config;

    Ok(())
}
