use anchor_lang::prelude::*;

#[account]
pub struct ListingState {
    pub asset: Pubkey,
    pub fraction_config: Pubkey,
    pub issuer: Pubkey,
    pub mint: Pubkey,
    pub sale_vault: Pubkey,
    pub platform_treasury: Pubkey,
    pub price_per_share_lamports: u64,
    pub remaining_supply: u64,
    pub start_ts: i64,
    pub end_ts: i64,
    pub platform_fee_bps: u16,
    pub trade_count: u64,
    pub is_active: bool,
    pub bump: u8,
}

impl ListingState {
    pub const SPACE: usize = 8 + (32 * 6) + 8 + 8 + 8 + 8 + 2 + 8 + 1 + 1;
}

#[account]
pub struct TradeReceipt {
    pub listing: Pubkey,
    pub buyer: Pubkey,
    pub issuer: Pubkey,
    pub mint: Pubkey,
    pub qty: u64,
    pub unit_price_lamports: u64,
    pub gross_amount_lamports: u64,
    pub fee_amount_lamports: u64,
    pub net_amount_lamports: u64,
    pub trade_index: u64,
    pub timestamp: i64,
    pub bump: u8,
}

impl TradeReceipt {
    pub const SPACE: usize = 8 + (32 * 4) + (8 * 7) + 1;
}
