use anchor_lang::prelude::*;
use anchor_spl::token::{set_authority, Mint, SetAuthority, Token};
use spl_token::instruction::AuthorityType;

use crate::{
    constants::{ASSET_SEED, MINT_AUTH_SEED},
    errors::TokenizationError,
    state::AssetConfig,
};

#[derive(Accounts)]
#[instruction(asset_id: String)]
pub struct RevokeMintAuthority<'info> {
    pub issuer: Signer<'info>,
    #[account(
        mut,
        seeds = [ASSET_SEED, asset_config.issuer.as_ref(), asset_id.as_bytes()],
        bump = asset_config.asset_bump,
        constraint = asset_config.issuer == issuer.key() @ TokenizationError::UnauthorizedIssuer,
    )]
    pub asset_config: Account<'info, AssetConfig>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(seeds = [MINT_AUTH_SEED, asset_config.key().as_ref()], bump = asset_config.mint_bump)]
    /// CHECK: PDA signer used only as current mint authority.
    pub mint_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<RevokeMintAuthority>, _asset_id: String) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.mint.key(),
        ctx.accounts.asset_config.mint,
        TokenizationError::InvalidMint
    );

    let asset_config_key = ctx.accounts.asset_config.key();
    let signer_seeds: &[&[u8]] = &[
        MINT_AUTH_SEED,
        asset_config_key.as_ref(),
        &[ctx.accounts.asset_config.mint_bump],
    ];
    let signer = &[signer_seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        SetAuthority {
            account_or_mint: ctx.accounts.mint.to_account_info(),
            current_authority: ctx.accounts.mint_authority.to_account_info(),
        },
        signer,
    );

    set_authority(cpi_ctx, AuthorityType::MintTokens, None)?;

    Ok(())
}
