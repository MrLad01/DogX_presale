use anchor_lang::prelude::*;
use anchor_spl::{};

use crate::state::Presale;

#[derive(Accounts)]
pub struct InitPresale<'info>{
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        seeds = [b"dogx_presale", admin.key().as_ref()],
        space = 8 + Presale::INIT_SPACE,
        bump,
    )]
    pub presale: Account<'info, Presale>,

    #[account(
        seeds = [b"dogx_vault", presale.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>
}

impl<'info> InitPresale<'info>{
    pub fn init_presale(
    &mut self,   
    token_mint_address: Pubkey,
    softcap_amount: u64,
    hardcap_amount: u64,
    deposit_token_amount: u64,
    sold_token_amount: u64,
    start_time: u64,
    end_time: u64,
    max_token_amount_per_address: u64,
    price_per_token: u64,
    bumps: &InitPresaleBumps
) -> Result<()>{
    self.presale.set_inner(Presale { 
        admin: self.admin.key(),
        token_mint_address,
        softcap_amount,
        hardcap_amount,
        deposit_token_amount,
        sold_token_amount,
        start_time,
        end_time,
        max_token_amount_per_address,
        price_per_token,
        is_live: false,
        is_soft_capped: false,
        is_hard_capped: false,
        bump: bumps.presale,
        vault_bump: bumps.vault 
    });
        
        Ok(())
    }
}