use anchor_lang::prelude::*;

use crate::{
    constants::{ASSET_SEED, FRACTION_SEED},
    errors::TokenizationError,
    state::{AssetConfig, FractionConfig},
};

#[derive(Accounts)]
#[instruction(asset_id: String)]
pub struct LockFractionModel<'info> {
    pub issuer: Signer<'info>,
    #[account(
        seeds = [ASSET_SEED, asset_config.issuer.as_ref(), asset_id.as_bytes()],
        bump = asset_config.asset_bump,
        constraint = asset_config.issuer == issuer.key() @ TokenizationError::UnauthorizedIssuer,
    )]
    pub asset_config: Account<'info, AssetConfig>,
    #[account(
        mut,
        seeds = [FRACTION_SEED, asset_config.key().as_ref()],
        bump = fraction_config.bump,
    )]
    pub fraction_config: Account<'info, FractionConfig>,
}

pub fn handler(ctx: Context<LockFractionModel>, _asset_id: String) -> Result<()> {
    let asset_config = &ctx.accounts.asset_config;
    let fraction_config = &mut ctx.accounts.fraction_config;

    require!(asset_config.is_minted, TokenizationError::AssetNotMinted);
    require!(fraction_config.sale_deposited, TokenizationError::SaleNotDeposited);
    require!(!fraction_config.is_locked, TokenizationError::FractionModelLocked);

    require_keys_eq!(
        fraction_config.asset,
        asset_config.key(),
        TokenizationError::InvalidFractionConfig
    );
    require_keys_eq!(
        fraction_config.issuer,
        ctx.accounts.issuer.key(),
        TokenizationError::UnauthorizedIssuer
    );

    fraction_config.is_locked = true;

    Ok(())
}
