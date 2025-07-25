use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::state::Presale;

#[derive(Accounts)]
 pub struct BuyToken <'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub presale: Account<'info, Presale>,
    #[account(mut)]
    pub buyer_mint: Account<'info, TokenAccount>,
    #[account(mut)]
    pub presale_mint: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>

 }