use anchor_lang::prelude::*;

#[derive(Accounts)]
 pub struct BuyToken <'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    

 }