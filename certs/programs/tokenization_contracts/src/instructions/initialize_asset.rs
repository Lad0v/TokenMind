use anchor_lang::prelude::*;

use crate::{
    constants::{ASSET_SEED, MAX_ASSET_ID_LEN},
    errors::TokenizationError,
    state::AssetConfig,
};

#[derive(Accounts)]
#[instruction(asset_id: String)]
pub struct InitializeAsset<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,
    #[account(
        init,
        payer = issuer,
        space = AssetConfig::SPACE,
        seeds = [ASSET_SEED, issuer.key().as_ref(), asset_id.as_bytes()],
        bump,
    )]
    pub asset_config: Account<'info, AssetConfig>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeAsset>,
    asset_id: String,
    total_shares: u64,
    sale_supply: u64,
) -> Result<()> {
    require!(asset_id.len() <= MAX_ASSET_ID_LEN, TokenizationError::AssetIdTooLong);
    require!(total_shares > 0, TokenizationError::InvalidTotalShares);
    require!(sale_supply <= total_shares, TokenizationError::InvalidSaleSupply);

    let asset_config = &mut ctx.accounts.asset_config;

    asset_config.asset_id = asset_id;
    asset_config.issuer = ctx.accounts.issuer.key();
    asset_config.mint = Pubkey::default();
    asset_config.total_shares = total_shares;
    asset_config.minted_supply = 0;
    asset_config.sale_supply = sale_supply;
    asset_config.mint_bump = 0;
    asset_config.asset_bump = ctx.bumps.asset_config;
    asset_config.is_minted = false;

    Ok(())
}
