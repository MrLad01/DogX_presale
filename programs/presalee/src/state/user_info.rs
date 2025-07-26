use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserInfo{
    // buyer's address
    pub buyer: Pubkey,
    // Buy quote amount
    pub buy_quote_amount: u64,
    // Buy token amount
    pub buy_token_amount: u64,
    // user has claimed token
    pub has_claimed_token: bool,
    // user has claimed token
    pub has_claimed_refund: bool,
    // Buy time
    pub buy_time: u64,
    // claim amount
    pub claim_amount: u64,
    // claim time
    pub claim_time: u64,
    // bump
    pub bump: u8
}