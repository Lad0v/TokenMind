use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

use crate::{
    constants::{ASSET_SEED, MINT_AUTH_SEED},
    errors::TokenizationError,
    state::AssetConfig,
};

#[derive(Accounts)]
#[instruction(asset_id: String)]
pub struct MintAssetTokens<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,
    #[account(
        mut,
        seeds = [ASSET_SEED, asset_config.issuer.as_ref(), asset_id.as_bytes()],
        bump = asset_config.asset_bump,
        constraint = asset_config.issuer == issuer.key() @ TokenizationError::UnauthorizedIssuer,
    )]
    pub asset_config: Account<'info, AssetConfig>,
    #[account(
        init,
        payer = issuer,
        mint::decimals = 0,
        mint::authority = mint_authority,
        mint::freeze_authority = mint_authority,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = issuer,
        associated_token::mint = mint,
        associated_token::authority = issuer,
    )]
    pub issuer_token_account: Account<'info, TokenAccount>,
    #[account(seeds = [MINT_AUTH_SEED, asset_config.key().as_ref()], bump)]
    /// CHECK: PDA signer used only as mint authority.
    pub mint_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<MintAssetTokens>, _asset_id: String) -> Result<()> {
    let asset_config = &mut ctx.accounts.asset_config;

    require!(!asset_config.is_minted, TokenizationError::AlreadyMinted);

    let asset_config_key = asset_config.key();
    let mint_auth_bump = ctx.bumps.mint_authority;
    let signer_seeds: &[&[u8]] = &[
        MINT_AUTH_SEED,
        asset_config_key.as_ref(),
        &[mint_auth_bump],
    ];
    let signer = &[signer_seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.issuer_token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        },
        signer,
    );

    mint_to(cpi_ctx, asset_config.total_shares)?;

    asset_config.mint = ctx.accounts.mint.key();
    asset_config.minted_supply = asset_config.total_shares;
    asset_config.mint_bump = mint_auth_bump;
    asset_config.is_minted = true;

    Ok(())
}
