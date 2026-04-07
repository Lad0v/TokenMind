use anchor_lang::prelude::*;

use crate::constants::MAX_ASSET_ID_LEN;

#[account]
pub struct AssetConfig {
    pub asset_id: String,
    pub issuer: Pubkey,
    pub mint: Pubkey,
    pub total_shares: u64,
    pub minted_supply: u64,
    pub sale_supply: u64,
    pub mint_bump: u8,
    pub asset_bump: u8,
    pub is_minted: bool,
}

impl AssetConfig {
    pub const SPACE: usize = 8 + (4 + MAX_ASSET_ID_LEN) + 32 + 32 + 8 + 8 + 8 + 1 + 1 + 1;
}
