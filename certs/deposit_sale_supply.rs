use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer},
};

use crate::{
    constants::{ASSET_SEED, FRACTION_SEED, VAULT_AUTH_SEED},
    errors::TokenizationError,
    state::{AssetConfig, FractionConfig},
};

#[derive(Accounts)]
#[instruction(asset_id: String)]
pub struct DepositSaleSupply<'info> {
    #[account(mut)]
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
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = issuer,
    )]
    pub issuer_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = issuer,
        associated_token::mint = mint,
        associated_token::authority = vault_authority,
    )]
    pub sale_vault: Account<'info, TokenAccount>,
    #[account(seeds = [VAULT_AUTH_SEED, fraction_config.key().as_ref()], bump)]
    /// CHECK: PDA used as token vault authority.
    pub vault_authority: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DepositSaleSupply>, _asset_id: String) -> Result<()> {
    let asset_config = &ctx.accounts.asset_config;
    let fraction_config = &mut ctx.accounts.fraction_config;

    require!(asset_config.is_minted, TokenizationError::AssetNotMinted);
    require!(!fraction_config.is_locked, TokenizationError::FractionModelLocked);
    require!(
        !fraction_config.sale_deposited,
        TokenizationError::SaleAlreadyDeposited
    );

    require_keys_eq!(
        ctx.accounts.mint.key(),
        asset_config.mint,
        TokenizationError::InvalidMint
    );
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
    require_keys_eq!(
        fraction_config.mint,
        ctx.accounts.mint.key(),
        TokenizationError::InvalidMint
    );

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.issuer_token_account.to_account_info(),
            to: ctx.accounts.sale_vault.to_account_info(),
            authority: ctx.accounts.issuer.to_account_info(),
        },
    );

    transfer(cpi_ctx, fraction_config.sale_supply)?;

    fraction_config.sale_deposited = true;

    Ok(())
}
