use anchor_lang::prelude::*;

use crate::{
    constants::LISTING_SEED,
    errors::TokenizationError,
    state::ListingState,
};

#[derive(Accounts)]
pub struct CloseListing<'info> {
    pub issuer: Signer<'info>,
    #[account(
        mut,
        seeds = [LISTING_SEED, listing.fraction_config.as_ref()],
        bump = listing.bump,
        constraint = listing.issuer == issuer.key() @ TokenizationError::UnauthorizedIssuer,
    )]
    pub listing: Account<'info, ListingState>,
}

pub fn handler(ctx: Context<CloseListing>) -> Result<()> {
    let listing = &mut ctx.accounts.listing;
    listing.is_active = false;

    Ok(())
}
