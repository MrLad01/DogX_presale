use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{
        Mint, TokenAccount, Token, TransferChecked, transfer_checked
    },
};

use crate::{errors::PresaleError, state::{Presale, UserInfo}};

#[derive(Accounts)]
 pub struct BuyToken <'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub token_mint_address: Account<'info, Mint>,
    pub usd_mint: Account<'info, Mint>,

    #[account(
        mut,
        has_one = token_mint_address,
        has_one = usd_mint,
        seeds = [b"dogx_presale", presale.admin.key().as_ref(), presale.seed.to_le_bytes().as_ref()],
        bump = presale.bump
    )]
    pub presale: Account<'info, Presale>,
    
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = usd_mint,
        associated_token::authority = buyer
    )]
    pub buyer_ata: Account<'info, TokenAccount>,
     #[account(
        init_if_needed,
        payer = buyer,
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

 impl <'info> BuyToken <'info> {
    pub fn buy_tokens(&mut self, payment: u64) -> Result<()> {
        let presale = &mut self.presale;
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp as u64;
        
        require!(presale.is_live, PresaleError::PresaleNotStarted);
        require!(current_time < presale.end_time, PresaleError::PresaleEnded);

        let mut remaining_payment = payment;
        let mut total_tokens_bought = 0u64;

        // Continue buying until payment is exhausted or all levels are sold out
        while remaining_payment > 0 && (presale.current_level as usize) < presale.levels.len() {
            let current_level_index = presale.current_level as usize;
            let current_level = &mut presale.levels[current_level_index];
            
            let tokens_remaining_in_level = current_level.token_amount - current_level.tokens_sold;
            
            msg!(
                "Level {} status: total_tokens={}, sold={}, remaining={}, price={}",
                current_level_index,
                current_level.token_amount,
                current_level.tokens_sold,
                tokens_remaining_in_level,
                current_level.price
            );
            
            // If current level is exhausted, move to next level
            if tokens_remaining_in_level == 0 {
                msg!("Level {} exhausted, moving to next level", current_level_index);
                presale.current_level += 1;
                continue;
            }

            // Calculate how many tokens can be bought with remaining payment at current price
            // Formula: tokens = (payment * 10^6) / price  (assuming 6 decimals for tokens)
            let tokens_can_afford = remaining_payment
                .checked_mul(1_000_000) // Scale up payment (6 decimals)
                .and_then(|x| x.checked_div(current_level.price))
                .ok_or(PresaleError::CalculationOverflow)?;
            
            // Take minimum of what can be afforded and what's available in this level
            let tokens_to_buy = tokens_can_afford.min(tokens_remaining_in_level);
            
            // Calculate exact cost for these tokens
            let cost_for_tokens = tokens_to_buy
                .checked_mul(current_level.price)
                .and_then(|x| x.checked_div(1_000_000))
                .ok_or(PresaleError::CalculationOverflow)?;

            msg!(
                "Purchase calculation: can_afford={}, will_buy={}, cost={}, remaining_payment={}",
                tokens_can_afford,
                tokens_to_buy,
                cost_for_tokens,
                remaining_payment
            );

            // Verify we don't exceed hardcap
            require!(
                (presale.sold_token_amount + tokens_to_buy) <= presale.hardcap_amount,
                PresaleError::HardCapped
            );

            // Verify we don't exceed deposited tokens
            require!(
                (presale.sold_token_amount + tokens_to_buy) <= presale.deposit_token_amount,
                PresaleError::ExceedsDepositAmount
            );

            // Update the current level and presale state
            current_level.tokens_sold += tokens_to_buy;
            presale.sold_token_amount += tokens_to_buy;
            total_tokens_bought += tokens_to_buy;
            remaining_payment -= cost_for_tokens;

            // Update presale flags
            presale.is_soft_capped = presale.sold_token_amount >= presale.softcap_amount;
            presale.is_hard_capped = presale.sold_token_amount >= presale.hardcap_amount;

            msg!(
                "After purchase: level_tokens_sold={}, total_sold={}, tokens_bought_this_tx={}, remaining_payment={}",
                current_level.tokens_sold,
                presale.sold_token_amount,
                total_tokens_bought,
                remaining_payment
            );

            // If current level is now exhausted, move to next level for next iteration
            if current_level.tokens_sold >= current_level.token_amount {
                msg!("Level {} completed, moving to next level", current_level_index);
                presale.current_level += 1;
            }

            // If we've hit hardcap, break out of loop
            if presale.is_hard_capped {
                break;
            }
        }

        // Check if we couldn't spend all the payment (this might be acceptable if hardcap reached)
        if remaining_payment > 0 {
            // If hardcap is reached, this is acceptable
            if !presale.is_hard_capped {
                msg!("Payment remaining: {} (all levels exhausted or insufficient tokens)", remaining_payment);
                return Err(PresaleError::ExactPaymentRequired.into());
            }
        }

        // Calculate actual amount spent
        let amount_spent = payment - remaining_payment;

        // Transfer the spent amount from buyer to presale vault
        transfer_checked(
            CpiContext::new(
                self.token_program.to_account_info(),
                TransferChecked {
                    from: self.buyer_ata.to_account_info(),
                    mint: self.usd_mint.to_account_info(),
                    to: self.vault_usd.to_account_info(),
                    authority: self.buyer.to_account_info(),
                },
            ),
            amount_spent,
            self.usd_mint.decimals
        )?;

        // Update user contribution
        let user_contribution = &mut self.user;
        if user_contribution.buy_quote_amount == 0 {
            user_contribution.buyer = self.buyer.key();
        }
        user_contribution.buy_quote_amount += amount_spent;
        user_contribution.buy_token_amount += total_tokens_bought;

        msg!("Transaction completed: total_tokens_bought={}, usd_spent={}, remaining_payment={}", 
             total_tokens_bought, amount_spent, remaining_payment);

        Ok(())
    }
}