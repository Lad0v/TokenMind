use anchor_lang::prelude::*;

#[account]
pub struct FractionConfig {
    pub asset: Pubkey,
    pub issuer: Pubkey,
    pub mint: Pubkey,
    pub total_shares: u64,
    pub sale_supply: u64,
    pub issuer_reserve: u64,
    pub platform_reserve: u64,
    pub sale_deposited: bool,
    pub is_locked: bool,
    pub bump: u8,
}

impl FractionConfig {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 1;
}
