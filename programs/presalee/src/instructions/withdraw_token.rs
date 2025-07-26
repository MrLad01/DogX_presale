use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
};

use crate::{
    errors::PresaleError,
    state::{Presale},
};

#[derive(Accounts)]
pub struct WithdrawToken<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    pub usd_mint: Account<'info, Mint>,
    pub token_mint_address: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token_mint_address,
        associated_token::authority = admin
    )]
    pub admin_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = token_mint_address,
        associated_token::authority = presale
    )]
    pub vault_dog: Account<'info, TokenAccount>,

    #[account(
        mut,
        has_one = token_mint_address,
        has_one = usd_mint,
        seeds = [b"dogx_presale", presale.seed.to_le_bytes().as_ref()],
        bump = presale.bump,
        close = admin
    )]
    pub presale: Account<'info, Presale>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> WithdrawToken<'info>{
    pub fn withdraw_token(&mut self) -> Result<()>{
    let presale = &mut self.presale;
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp as u64;
    let is_ended = !presale.is_live || current_time >= presale.end_time;
    require!(is_ended, PresaleError::PresaleNotEnded);

    require!(
            presale.sold_token_amount >= presale.softcap_amount,
            PresaleError::SoftCapNotReached
        );

        let amount = presale.sold_token_amount;

         let seeds = &[
            &b"dogx_presale"[..],
            &self.presale.seed.to_le_bytes(),
            &[self.presale.bump],
        ];
        
        let signers_seeds = &[&seeds[..]];

        transfer_checked(
        CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            TransferChecked {
                from: self.vault_dog.to_account_info(),
                mint: self.token_mint_address.to_account_info(),
                to: self.admin_ata.to_account_info(),
                authority: self.presale.to_account_info(),
            },
            signers_seeds,
        ),
        amount,
        self.usd_mint.decimals
    )?;
        Ok(())
    }
}
