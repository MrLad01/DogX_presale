use anchor_lang::prelude::*;

use crate::{errors::PresaleError, state:: Presale};

#[derive(Accounts)]
pub struct EndPresale<'info>{
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

impl<'info> EndPresale<'info>{
    pub fn end_presale(&mut self,) -> Result<()>{
    //checks if presale is live
    require!(self.presale.is_live, PresaleError::PresaleEnded);
    //end presale
    self.presale.is_live = false;
    Ok(())
    }
}