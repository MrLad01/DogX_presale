use anchor_lang::prelude::*;
use anchor_spl::token::{close_account, CloseAccount};

use crate::state:: Presale;

#[derive(Accounts)]
pub struct ClosePresale<'info>{
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"dogx_presale", presale.admin.key().as_ref(), presale.seed.to_le_bytes().as_ref()],
        bump = presale.bump,
        close = admin
    )]
    pub presale: Account<'info, Presale>,

    pub system_program: Program<'info, System>

}

impl<'info> ClosePresale<'info>{
    pub fn close_presale(&mut self,) -> Result<()>{
    //checks if presale is live
        let close_accounts = CloseAccount{
            account: self.presale.to_account_info(),
            destination: self.admin.to_account_info(),
            authority: self.admin.to_account_info(),
        };

        let close_cpi_ctx= CpiContext::new(self.system_program.to_account_info(), close_accounts);

        close_account(close_cpi_ctx)?;

        Ok(())
    }
}