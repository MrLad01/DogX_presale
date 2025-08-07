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
    )]
    pub presale: Account<'info, Presale>,

    pub system_program: Program<'info, System>
}

impl<'info> EndPresale<'info>{
    pub fn end_presale(&mut self,) -> Result<()>{
        let presale = &mut self.presale;
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp as u64;
        //checks if presale is live
        require!(presale.is_live || current_time >= presale.end_time, PresaleError::PresaleEnded);
        //end presale
        self.presale.is_live = false;
        Ok(())
    }
}