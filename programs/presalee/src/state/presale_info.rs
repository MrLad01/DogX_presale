use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Presale{
    pub seed: u64,
    // Authority of the presale
    pub admin: Pubkey,
    // Presale is buyable
    pub is_live: bool,
    // Current level of the presale
    pub current_level: u8,     
    // Array of presale levels     
    pub levels: [Level; 7],         
    // Total amount of presale tokens sold during the presale
    pub sold_token_amount: u64,
    // Mint address of the presale token (DGX)
    pub token_mint_address: Pubkey,
    // Mint address of USDT
    pub usd_mint: Pubkey,
    // Softcap (Minimum funds required)
    pub softcap_amount: u64,
    // Hardcap (Maximum funds to raise)
    pub hardcap_amount: u64,
    // Total amount of presale tokens available in the presale
    pub deposit_token_amount: u64,
    // Start time of presale
    pub start_time: u64,
    // End time of presale
    pub end_time: u64,
    // Status of softcapped
    pub is_soft_capped: bool,
    // Status of hardcapped
    pub is_hard_capped: bool,
    // PDA bump
    pub bump: u8
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
#[derive(InitSpace)]
pub struct Level {
    pub token_amount: u64,  // Total tokens available in this level (in lamports)
    pub price: u64,         // Price per whole token in USDT lamports
    pub soft_cap: u64,      // Soft cap for this level in USDT lamports
    pub tokens_sold: u64,   // Tokens sold in this level (in lamports)
}