use anchor_lang::prelude::*;

use crate::state::{Presale, UserInfo};


#[derive(Accounts)]
pub struct InitUser<'info>{
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"dogx_presale", presale.admin.key().as_ref(), presale.seed.to_le_bytes().as_ref()],
        bump = presale.bump,
    )]
    pub presale: Account<'info, Presale>,

    #[account(
        init_if_needed,
        payer = buyer,
        seeds = [b"user",  presale.key().as_ref(), buyer.key().as_ref()],
        space = 8 + UserInfo::INIT_SPACE,
        bump,
    )]
    pub user_info: Account<'info, UserInfo>,

    pub system_program: Program<'info, System>
}

impl<'info> InitUser<'info>{
    pub fn init_user(&mut self, buy_quote_amount: u64, buy_token_amount: u64, buy_time: u64, claim_amount: u64, claim_time: u64, bumps: &InitUserBumps) -> Result<()>{
        self.user_info.set_inner(UserInfo {
            buyer: self.buyer.key(), 
            buy_quote_amount,
            buy_token_amount,
            has_claimed_token: false,
            has_claimed_refund: false,
            buy_time,
            claim_amount,
            claim_time,
            bump: bumps.user_info 
        });
        
        Ok(())
    }
}