use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{Mint, Token, TokenAccount}};

use crate::state::{Level, Presale};

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct InitPresale<'info>{
    #[account(mut)]
    pub admin: Signer<'info>,

    pub token_mint_address: Account<'info, Mint>,
    pub usd_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        seeds = [b"dogx_presale", admin.key().as_ref(), seed.to_le_bytes().as_ref()],
        space = 8 + Presale::INIT_SPACE,
        bump,
    )]
    pub presale: Account<'info, Presale>,

    #[account(
        init,
        payer = admin,
        associated_token::mint = token_mint_address,
        associated_token::authority = presale
    )]
    pub vault_dog: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = admin,
        associated_token::mint = usd_mint,
        associated_token::authority = presale
    )]
    pub vault_usd: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> InitPresale<'info>{
    pub fn init_presale(
    &mut self,   
    seed: u64,
    token_mint_address: Pubkey,
    usd_mint: Pubkey,
    softcap_amount: u64,
    hardcap_amount: u64,
    deposit_token_amount: u64,
    levels: [Level; 7], 
    sold_token_amount: u64,
    start_time: u64,
    end_time: u64,
    bumps: &InitPresaleBumps
) -> Result<()>{
    self.presale.set_inner(Presale {
        seed, 
        admin: self.admin.key(),
        token_mint_address,
        usd_mint,
        current_level: 0,
        softcap_amount,
        hardcap_amount,
        deposit_token_amount,
        sold_token_amount,
        start_time,
        end_time,
        levels,
        is_live: false,
        is_soft_capped: false,
        is_hard_capped: false,
        bump: bumps.presale,
    });
        
        Ok(())
    }
}