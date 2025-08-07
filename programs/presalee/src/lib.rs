#![allow(unexpected_cfgs, deprecated)]
use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;

use instructions::*;
use state::*;

declare_id!("NtPYU5WiCYcwaTScEMxRYeKYeeep87hUeeATrjHKLdn");

#[program]
pub mod presalee {
    use super::*;

    pub fn init_presale(
        ctx: Context<InitPresale>, 
        seed: u64, 
        token_mint_address: Pubkey,
        usd_mint: Pubkey,
        softcap_amount: u64,
        hardcap_amount: u64,
        deposit_token_amount: u64,
        levels: [Level; 7], 
        sold_token_amount: u64,
        start_time: u64,
        end_time: u64 ) -> Result<()> {
            ctx.accounts.init_presale(seed, token_mint_address, usd_mint, softcap_amount, hardcap_amount, deposit_token_amount, levels, sold_token_amount, start_time, end_time, &ctx.bumps)?;
        Ok(())
    }

    pub fn init_user(
        ctx: Context<InitUser>,
        buy_quote_amount: u64,
        buy_token_amount: u64, 
        buy_time: u64, 
        claim_amount: u64, 
        claim_time: u64,
    ) -> Result<()> {
        ctx.accounts.init_user(buy_quote_amount, buy_token_amount, buy_time, claim_amount, claim_time, &ctx.bumps)?;
        Ok(())
    }

    pub fn start_presale(ctx: Context<StartPresale>) -> Result<()> {
        ctx.accounts.start_presale()?;
        Ok(())
    }

    pub fn deposit_token(ctx: Context<DepositToken>, amount: u64) -> Result<()> {
        ctx.accounts.deposit_token(amount)?;
        Ok(())
    }

     pub fn buy_tokens(ctx: Context<BuyToken>, payment: u64) -> Result<()> {
        ctx.accounts.buy_tokens(payment)?;
        Ok(())
    }

    pub fn claim_token(ctx: Context<ClaimToken>,) -> Result<()> {
        ctx.accounts.claim_token()?;
        Ok(())
    }

    pub fn withdraw_token(ctx: Context<WithdrawToken>) -> Result<()>{
        ctx.accounts.withdraw_token()?;
        Ok(())
    }
    pub fn withdraw_usd(ctx: Context<WithdrawUsd>) -> Result<()>{
        ctx.accounts.withdraw_usd()?;
        Ok(())
    }

    pub fn end_presale(ctx: Context<EndPresale>) -> Result<()>{
        ctx.accounts.end_presale()?;
        Ok(())
    }

    pub fn refund(ctx: Context<ClaimRefund>) -> Result<()>{
        ctx.accounts.claim_refund()?;
        Ok(())
    }

    pub fn close_presale(ctx: Context<ClosePresale>) -> Result<()> {
        ctx.accounts.close_presale()?;
        Ok(())
    }
}

