use anchor_lang::prelude::*;

#[error_code]
pub enum PresaleError {
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,
    #[msg("Not allowed")]
    NotAllowed,
    #[msg("Math operation overflow")]
    MathOverflow,
    #[msg("Already marked")]
    AlreadyMarked,
    #[msg("Presale not started yet")]
    PresaleNotStarted,
    #[msg("Presale already ended")]
    PresaleEnded,
    #[msg("User already claimed")]
    AlreadyClaimed,
    #[msg("Presale is live already")]
    AlreadyLive,
    #[msg("Token amount mismatch")]
    TokenAmountMismatch,
    #[msg("Insufficient Tokens")]
    InsufficientFund,
    #[msg("Presale not ended yet")]
    PresaleNotEnded,
    #[msg("Presale already ended")]
    HardCapped,
    #[msg("Presale soft cap not reached")]
    SoftCapNotReached,
    #[msg("Presale soft cap reached")]
    SoftCapReached,
    #[msg("Amount exceeds available")]
    CalculationOverflow,
    #[msg("Cannot buy. Token limit exceeded")]
    ExceedsDepositAmount,
    #[msg("Exact payment required")]
    ExactPaymentRequired
}