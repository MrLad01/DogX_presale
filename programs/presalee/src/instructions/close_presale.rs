use anchor_lang::prelude::*;

use crate::state::Presale;

#[derive(Accounts)]
pub struct ClosePresale<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"dogx_presale", presale.admin.key().as_ref(), presale.seed.to_le_bytes().as_ref()],
        bump = presale.bump,
        close = admin
    )]
    pub presale: Account<'info, Presale>,

    pub system_program: Program<'info, System>,
}

impl<'info> ClosePresale<'info> {
    pub fn close_presale(&mut self) -> Result<()> {
        // Ensure presale is ended
        require!(!self.presale.is_live, ErrorCode::PresaleNotEnded);

        // The presale account will be closed automatically due to `close = admin`
        Ok(())
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Presale has not ended")]
    PresaleNotEnded,
}