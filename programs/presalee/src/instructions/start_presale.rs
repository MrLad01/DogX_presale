use anchor_lang::prelude::*;

use crate::{errors::PresaleError, state::Presale};

#[derive(Accounts)]
pub struct StartPresale<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"dogx_presale", presale.admin.key().as_ref(), presale.seed.to_le_bytes().as_ref()],
        bump = presale.bump,
        has_one = admin,
    )]
    pub presale: Account<'info, Presale>,
}

impl<'info> StartPresale<'info> {
    pub fn start_presale(&mut self) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp as u64;
        
        // Validations
        require!(!self.presale.is_live, PresaleError::AlreadyLive);
        require!(current_time < self.presale.end_time, PresaleError::PresaleEnded);
        
        // Start the presale
        self.presale.is_live = true;
        self.presale.start_time = current_time;
        
        Ok(())
    }
}