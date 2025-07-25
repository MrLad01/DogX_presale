use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{transfer, Mint, Token, TokenAccount, Transfer}};

use crate::state::{Presale};

#[derive(Accounts)]
pub struct DepositToken<'info>{
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        address = presale.token_mint_address
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = admin
    )]
    pub admin_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = presale
    )]
    pub presale_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"dogx_presale", admin.key().as_ref()],
        bump = presale.bump
    )]
    pub presale: Account<'info, Presale>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>
}

impl <'info> DepositToken<'info> {
    pub fn deposit_token(&mut self, amount: u64) -> Result<()> {
        let cpi_program =  self.token_program.to_account_info();

        let cpi_accounts = Transfer{
            from : self.admin_ata.to_account_info(),
            to: self.presale_ata.to_account_info(),
            authority: self.admin.to_account_info() 
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        transfer(cpi_ctx, amount)?;

        self.presale.deposit_token_amount = self.presale.deposit_token_amount + amount;
        
        Ok(())
    }
}
