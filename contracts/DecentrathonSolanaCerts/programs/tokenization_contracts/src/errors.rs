use anchor_lang::prelude::*;

#[error_code]
pub enum TokenizationError {
    #[msg("Asset id is too long")]
    AssetIdTooLong,
    #[msg("Total shares must be greater than zero")]
    InvalidTotalShares,
    #[msg("Sale supply cannot exceed total shares")]
    InvalidSaleSupply,
    #[msg("Asset tokens were already minted")]
    AlreadyMinted,
    #[msg("Invalid mint account")]
    InvalidMint,
    #[msg("Only issuer can perform this action")]
    UnauthorizedIssuer,
    #[msg("Asset tokens are not minted yet")]
    AssetNotMinted,
    #[msg("Invalid fractional allocation")]
    InvalidFractionAllocation,
    #[msg("Fraction config does not match asset")]
    InvalidFractionConfig,
    #[msg("Sale supply was already deposited")]
    SaleAlreadyDeposited,
    #[msg("Sale supply must be deposited first")]
    SaleNotDeposited,
    #[msg("Fraction model is locked")]
    FractionModelLocked,
    #[msg("Fraction model is not locked")]
    FractionNotLocked,
    #[msg("Listing price must be greater than zero")]
    InvalidPrice,
    #[msg("Invalid listing time window")]
    InvalidTimeWindow,
    #[msg("Invalid platform fee bps")]
    InvalidFeeBps,
    #[msg("Listing is inactive")]
    ListingInactive,
    #[msg("Quantity must be greater than zero")]
    InvalidQty,
    #[msg("Listing supply is insufficient")]
    InsufficientListingSupply,
    #[msg("Listing is outside active time window")]
    ListingOutsideWindow,
    #[msg("Invalid listing account")]
    InvalidListingAccount,
    #[msg("Math overflow")]
    MathOverflow,
}
