use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::state::{Presale, UserInfo};

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

    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + UserInfo::INIT_SPACE,
        seeds = [b"user", presale.key().as_ref(), buyer.key().as_ref() ],
        bump
    )]
    pub user: Account<'info, UserInfo>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>

 }