use anchor_lang::{prelude::*, system_program};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer},
};

use crate::{
    constants::{FRACTION_SEED, LISTING_SEED, TRADE_SEED, VAULT_AUTH_SEED},
    errors::TokenizationError,
    state::{FractionConfig, ListingState, TradeReceipt},
};

#[derive(Accounts)]
pub struct BuyShares<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        seeds = [LISTING_SEED, listing.fraction_config.as_ref()],
        bump = listing.bump,
    )]
    pub listing: Account<'info, ListingState>,
    #[account(
        init,
        payer = buyer,
        space = TradeReceipt::SPACE,
        seeds = [TRADE_SEED, listing.key().as_ref(), &listing.trade_count.to_le_bytes()],
        bump,
    )]
    pub trade_receipt: Account<'info, TradeReceipt>,
    #[account(
        seeds = [FRACTION_SEED, listing.asset.as_ref()],
        bump = fraction_config.bump,
        constraint = fraction_config.key() == listing.fraction_config @ TokenizationError::InvalidFractionConfig,
    )]
    pub fraction_config: Account<'info, FractionConfig>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault_authority,
    )]
    pub sale_vault: Account<'info, TokenAccount>,
    #[account(seeds = [VAULT_AUTH_SEED, fraction_config.key().as_ref()], bump)]
    /// CHECK: PDA used as token vault authority.
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    /// CHECK: Receiver account for net proceeds.
    #[account(mut)]
    pub issuer: UncheckedAccount<'info>,
    /// CHECK: Receiver account for platform fee.
    #[account(mut)]
    pub platform_treasury: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<BuyShares>, qty: u64) -> Result<()> {
    let listing = &mut ctx.accounts.listing;

    require!(listing.is_active, TokenizationError::ListingInactive);
    require!(qty > 0, TokenizationError::InvalidQty);
    require!(qty <= listing.remaining_supply, TokenizationError::InsufficientListingSupply);
    require!(listing.price_per_share_lamports > 0, TokenizationError::InvalidPrice);
    require!(
        listing.platform_fee_bps <= 10_000,
        TokenizationError::InvalidFeeBps
    );

    let now = Clock::get()?.unix_timestamp;
    require!(now >= listing.start_ts && now <= listing.end_ts, TokenizationError::ListingOutsideWindow);

    require_keys_eq!(ctx.accounts.issuer.key(), listing.issuer, TokenizationError::InvalidListingAccount);
    require_keys_eq!(ctx.accounts.platform_treasury.key(), listing.platform_treasury, TokenizationError::InvalidListingAccount);
    require_keys_eq!(ctx.accounts.mint.key(), listing.mint, TokenizationError::InvalidMint);
    require_keys_eq!(ctx.accounts.sale_vault.key(), listing.sale_vault, TokenizationError::InvalidListingAccount);

    let gross = qty
        .checked_mul(listing.price_per_share_lamports)
        .ok_or(TokenizationError::MathOverflow)?;

    let fee_u128 = (gross as u128)
        .checked_mul(listing.platform_fee_bps as u128)
        .ok_or(TokenizationError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(TokenizationError::MathOverflow)?;

    let fee = u64::try_from(fee_u128).map_err(|_| error!(TokenizationError::MathOverflow))?;
    let net = gross.checked_sub(fee).ok_or(TokenizationError::MathOverflow)?;

    let pay_issuer_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.buyer.to_account_info(),
            to: ctx.accounts.issuer.to_account_info(),
        },
    );
    system_program::transfer(pay_issuer_ctx, net)?;

    if fee > 0 {
        let pay_platform_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.platform_treasury.to_account_info(),
            },
        );
        system_program::transfer(pay_platform_ctx, fee)?;
    }

    let fraction_key = ctx.accounts.fraction_config.key();
    let vault_auth_bump = ctx.bumps.vault_authority;
    let signer_seeds: &[&[u8]] = &[VAULT_AUTH_SEED, fraction_key.as_ref(), &[vault_auth_bump]];
    let signer = &[signer_seeds];

    let token_cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.sale_vault.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        },
        signer,
    );
    transfer(token_cpi_ctx, qty)?;

    let trade_index = listing.trade_count;

    listing.remaining_supply = listing
        .remaining_supply
        .checked_sub(qty)
        .ok_or(TokenizationError::MathOverflow)?;
    listing.trade_count = listing
        .trade_count
        .checked_add(1)
        .ok_or(TokenizationError::MathOverflow)?;

    if listing.remaining_supply == 0 {
        listing.is_active = false;
    }

    let receipt = &mut ctx.accounts.trade_receipt;
    receipt.listing = listing.key();
    receipt.buyer = ctx.accounts.buyer.key();
    receipt.issuer = listing.issuer;
    receipt.mint = listing.mint;
    receipt.qty = qty;
    receipt.unit_price_lamports = listing.price_per_share_lamports;
    receipt.gross_amount_lamports = gross;
    receipt.fee_amount_lamports = fee;
    receipt.net_amount_lamports = net;
    receipt.trade_index = trade_index;
    receipt.timestamp = now;
    receipt.bump = ctx.bumps.trade_receipt;

    Ok(())
}
