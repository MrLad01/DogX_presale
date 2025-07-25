use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken,  token::{
        Mint, TokenAccount, Token, TransferChecked, transfer_checked
    },
};

use crate::{errors::PresaleError, state::{Presale, UserInfo}};

#[derive(Accounts)]
 pub struct BuyToken <'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub presale: Account<'info, Presale>,
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = buyer
    )]
    pub buyer_ata: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"dogx_vault", presale.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,
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


 impl <'info> BuyToken <'info> {
    pub fn buy_tokens(&mut self, payment: u64) -> Result<()> {
    let presale = &mut self.presale;
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp as u64;
    require!(presale.is_live, PresaleError::PresaleNotStarted);
    require!(current_time < presale.end_time, PresaleError::PresaleEnded);

    let mut remaining_payment = payment;
    let mut tokens_bought = 0;

    let current_level = presale.current_level as usize;

    while remaining_payment > 0 && (presale.current_level as usize) < presale.levels.len() {
        let level_price = presale.levels[current_level].price;
        let level_token_amount = presale.levels[current_level].token_amount;
        let level_tokens_sold = presale.levels[current_level].tokens_sold;
        let remaining_tokens = level_token_amount - level_tokens_sold;
        if remaining_tokens == 0 {
            presale.current_level += 1;
            continue;
        }
        require!(
            presale.sold_token_amount + tokens_bought <= presale.deposit_token_amount,
            PresaleError::ExceedsDepositAmount
        );

        if presale.levels[current_level].tokens_sold == level_token_amount {
            presale.current_level += 1;
        }

        // let tokens_can_buy = (remaining_payment as u128 * 1_000_000_000) / level.price as u128;
        // let tokens_can_buy = tokens_can_buy as u64;
        let tokens_can_buy = remaining_payment
            .checked_mul(1_000_000_000)
            .and_then(|x| x.checked_div(level_price))
            .ok_or(PresaleError::CalculationOverflow)? as u64;
        let tokens_to_buy = tokens_can_buy.min(remaining_tokens);
        let cost = tokens_to_buy
            .checked_mul(level_price)
            .and_then(|x| x.checked_div(1_000_000_000))
            .ok_or(PresaleError::CalculationOverflow)?;
        

        require!(
            presale.sold_token_amount + cost as u64 <= presale.hardcap_amount,
            PresaleError::HardCapped
        );

        presale.levels[current_level].tokens_sold += tokens_to_buy;
        // presale.sold_token_amount += cost as u64;
        presale.sold_token_amount += tokens_bought;
        remaining_payment -= cost as u64;
        tokens_bought += tokens_to_buy;

        if level_tokens_sold >= level_token_amount {
            presale.current_level += 1;
        }

        presale.is_soft_capped = presale.sold_token_amount >= presale.softcap_amount;
        presale.is_hard_capped = presale.sold_token_amount >= presale.hardcap_amount;
    }

    require!(remaining_payment == 0, PresaleError::InsufficientFund);

    transfer_checked(
        CpiContext::new(
            self.token_program.to_account_info(),
            TransferChecked {
                from: self.buyer_ata.to_account_info(),
                mint: self.token_mint.to_account_info(),
                to: self.vault.to_account_info(),
                authority: self.buyer.to_account_info(),
            },
        ),
        payment,
        self.token_mint.decimals
    )?;

    let user_contribution = &mut self.user;
    if user_contribution.buy_quote_amount == 0 {
      user_contribution.buyer = self.buyer.key();
    }
    user_contribution.buy_quote_amount += payment;
    user_contribution.buy_token_amount += tokens_bought;

    Ok(())
    }
 }