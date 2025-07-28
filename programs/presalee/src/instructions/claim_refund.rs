use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{
        Mint, TokenAccount, Token, TransferChecked, transfer_checked
    },
};

use crate::{errors::PresaleError, state::{Presale, UserInfo}};

#[derive(Accounts)]
 pub struct ClaimRefund<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub token_mint_address: Account<'info, Mint>,
    pub usd_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = buyer,
        has_one = token_mint_address,
        has_one = usd_mint,
        // seeds = [b"dogx_presale", presale.seed.to_le_bytes().as_ref()],
        // bump,
        space = Presale::INIT_SPACE + UserInfo::INIT_SPACE
    )]
    pub presale: Account<'info, Presale>,
    #[account(
        mut,
        associated_token::mint = usd_mint,
        associated_token::authority = buyer
    )]
    pub buyer_ata: Account<'info, TokenAccount>,
     #[account(
        mut,
        associated_token::mint = usd_mint,
        associated_token::authority = presale
    )]
    pub vault_usd: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + UserInfo::INIT_SPACE,
        seeds = [b"user", presale.key().as_ref(), buyer.key().as_ref() ],
        bump
    )]
    pub user: Account<'info, UserInfo>,

    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>

 }

 impl<'info> ClaimRefund<'info>{
    pub fn claim_refund(&mut self) -> Result<()>{
        let presale = &mut self.presale;
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp as u64;
        let is_ended = !presale.is_live || current_time >= presale.end_time;
        require!(is_ended, PresaleError::PresaleNotEnded);

        require!(
            presale.sold_token_amount < presale.softcap_amount,
            PresaleError::SoftCapReached
        );

        require!(!self.user.has_claimed_refund, PresaleError::AlreadyClaimed);

        let refund_amount = self.user.buy_token_amount;

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
                from: self.vault_usd.to_account_info(),
                mint: self.usd_mint.to_account_info(),
                to: self.buyer_ata.to_account_info(),
                authority: self.presale.to_account_info(),
            },
            signers_seeds,
        ),
        refund_amount,
        self.token_mint_address.decimals
    )?;

        self.user.has_claimed_refund = true;
        Ok(())
    }
 }
