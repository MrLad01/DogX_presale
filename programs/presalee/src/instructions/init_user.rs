use anchor_lang::prelude::*;

use crate::state::UserInfo;


#[derive(Accounts)]
pub struct InitUser<'info>{
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        init,
        payer = buyer,
        seeds = [b"user", buyer.key().as_ref()],
        space = 8 + UserInfo::INIT_SPACE,
        bump,
    )]
    pub user_info: Account<'info, UserInfo>,

    pub system_program: Program<'info, System>
}

impl<'info> InitUser<'info>{
    pub fn init_user(&mut self, buy_quote_amount: u64, buy_token_amount: u64, buy_time: u64, claim_amount: u64, claim_time: u64,bumps: &InitUserBumps) -> Result<()>{
        self.user_info.set_inner(UserInfo {
            buyer: self.buyer.key(), 
            buy_quote_amount,
            buy_token_amount,
            buy_time,
            claim_amount,
            claim_time,
            bump: bumps.user_info 
        });
        
        Ok(())
    }
}