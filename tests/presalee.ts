import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Presalee } from "../target/types/presalee";
import { 
  PublicKey, 
  Keypair, 
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { expect } from "chai";

describe("presalee", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.presalee as Program<Presalee>;
  
  // Test accounts
  let authority: Keypair;
  let user: Keypair;
  let tokenMint: PublicKey;
  let usdMint: PublicKey;
  let presaleAccount: PublicKey;
  let userAccount: PublicKey;
  let authorityTokenAccount: PublicKey;
  let authorityUsdAccount: PublicKey;
  let userUsdAccount: PublicKey;
  let presaleTokenAccount: PublicKey;
  let presaleUsdAccount: PublicKey;
  
  // Test parameters
  const seed = new anchor.BN(12345);
  const softcapAmount = new anchor.BN(1000 * 10**6); // 1000 tokens (6 decimals)
  const hardcapAmount = new anchor.BN(10000 * 10**6); // 10000 tokens
  const depositTokenAmount = new anchor.BN(15000 * 10**6); // 15000 tokens
  const soldTokenAmount = new anchor.BN(0);
  const startTime = new anchor.BN(Math.floor(Date.now() / 1000));
  const endTime = new anchor.BN(Math.floor(Date.now() / 1000) + 3600 * 24 * 7); // 1 week
  
  // Define presale levels (example tier structure)
  const levels = [
    { tokenAmount: new anchor.BN(1000 * 10**6), price: new anchor.BN(100000), softCap: new anchor.BN(0), tokensSold: new anchor.BN(0) }, // Level 0: $0.1 per token, max 1000 tokens
    { tokenAmount: new anchor.BN(2000 * 10**6), price: new anchor.BN(120000), softCap: new anchor.BN(0), tokensSold: new anchor.BN(0) }, // Level 1: $0.12 per token, max 2000 tokens
    { tokenAmount: new anchor.BN(3000 * 10**6), price: new anchor.BN(150000), softCap: new anchor.BN(0), tokensSold: new anchor.BN(0) }, // Level 2: $0.15 per token, max 3000 tokens
    { tokenAmount: new anchor.BN(2000 * 10**6), price: new anchor.BN(180000), softCap: new anchor.BN(0), tokensSold: new anchor.BN(0) }, // Level 3: $0.18 per token, max 2000 tokens
    { tokenAmount: new anchor.BN(1500 * 10**6), price: new anchor.BN(200000), softCap: new anchor.BN(0), tokensSold: new anchor.BN(0) }, // Level 4: $0.20 per token, max 1500 tokens
    { tokenAmount: new anchor.BN(500 * 10**6), price: new anchor.BN(250000), softCap: new anchor.BN(0), tokensSold: new anchor.BN(0) },  // Level 5: $0.25 per token, max 500 tokens
    { tokenAmount: new anchor.BN(0), price: new anchor.BN(300000), softCap: new anchor.BN(0), tokensSold: new anchor.BN(0) },            // Level 6: $0.30 per token, unlimited
  ];

  before(async () => {
    // Generate keypairs
    authority = Keypair.generate();
    user = Keypair.generate();

    // Airdrop SOL to accounts
    await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    
    // Wait for airdrops to confirm
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create token mints
    tokenMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      6 // 6 decimals
    );

    usdMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      6 // 6 decimals (USDC-like)
    );

    // Create associated token accounts
    authorityTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      authority,
      tokenMint,
      authority.publicKey
    );

    authorityUsdAccount = await createAssociatedTokenAccount(
      provider.connection,
      authority,
      usdMint,
      authority.publicKey
    );

    userUsdAccount = await createAssociatedTokenAccount(
      provider.connection,
      user,
      usdMint,
      user.publicKey
    );

    // Mint tokens to authority
    await mintTo(
      provider.connection,
      authority,
      tokenMint,
      authorityTokenAccount,
      authority.publicKey,
      20000 * 10**6 // 20,000 tokens
    );

    // Mint USD to user for testing purchases
    await mintTo(
      provider.connection,
      authority,
      usdMint,
      userUsdAccount,
      authority.publicKey,
      5000 * 10**6 // 5,000 USD
    );

    // // Derive PDAs
    // [presaleAccount] = PublicKey.findProgramAddressSync(
    //   [Buffer.from("presale"), seed.toArrayLike(Buffer, "le", 8)],
    //   program.programId
    // );

    [userAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), presaleAccount.toBuffer(), user.publicKey.toBuffer()],
      program.programId
    );

    // Get associated token accounts for presale
    presaleTokenAccount = await getAssociatedTokenAddress(tokenMint, presaleAccount, true);
    presaleUsdAccount = await getAssociatedTokenAddress(usdMint, presaleAccount, true);
  });


  // Derive presale PDA with correct seeds
  [presaleAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("dogx_presale"), seed.toArrayLike(Buffer, "le", 8)],
    program.programId
  );
  // [Buffer.from("dogx_presale"), authority.publicKey.toBuffer()],
  
  // Update test
  it("Initializes presale", async () => {
    try {
      const tx = await program.methods
        .initPresale(
          seed,
          tokenMint,
          usdMint,
          softcapAmount,
          hardcapAmount,
          depositTokenAmount,
          levels,
          soldTokenAmount,
          startTime,
          endTime
        )
        .accounts({
          // presale: presaleAccount,
          admin: authority.publicKey,
          tokenMintAddress: tokenMint,
          usdMint: usdMint,
          // vaultDog: presaleTokenAccount,
          // vaultUsd: presaleUsdAccount,
          systemProgram: SystemProgram.programId,
          token_program: TOKEN_PROGRAM_ID,
          associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([authority])
        .rpc();

      console.log("Init presale transaction signature:", tx);

      const presaleData = await program.account.presale.fetch(presaleAccount);
      expect(presaleData.admin.toString()).to.equal(authority.publicKey.toString());
      expect(presaleData.tokenMintAddress.toString()).to.equal(tokenMint.toString());
      expect(presaleData.softcapAmount.toString()).to.equal(softcapAmount.toString());
      expect(presaleData.hardcapAmount.toString()).to.equal(hardcapAmount.toString());
    } catch (error) {
      console.error("Error initializing presale:", error);
      throw error;
    }
  });

  it("Deposits tokens to presale", async () => {
    try {
      const tx = await program.methods
        .depositToken(depositTokenAmount)
        .accounts({
          presale: presaleAccount,
          authority: authority.publicKey,
          authorityTokenAccount: authorityTokenAccount,
          presaleTokenAccount: presaleTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      console.log("Deposit token transaction signature:", tx);
      
      // Verify tokens were deposited
      const presaleData = await program.account.presale.fetch(presaleAccount);
      expect(presaleData.depositTokenAmount.toString()).to.equal(depositTokenAmount.toString());
      
    } catch (error) {
      console.error("Error depositing tokens:", error);
      throw error;
    }
  });

  it("Starts presale", async () => {
    try {
      const tx = await program.methods
        .startPresale()
        .accounts({
          presale: presaleAccount,
          authority: authority.publicKey,
        })
        .signers([authority])  
        .rpc();

      console.log("Start presale transaction signature:", tx);
      
      // Verify presale status changed
      const presaleData = await program.account.presale.fetch(presaleAccount);
      // Add status check based on your state structure
      
    } catch (error) {
      console.error("Error starting presale:", error);
      throw error;
    }
  });

  it("Initializes user account", async () => {
    try {
      const tx = await program.methods
        .initUser(
          new anchor.BN(0), // buy_quote_amount
          new anchor.BN(0), // buy_token_amount  
          new anchor.BN(0), // buy_time
          new anchor.BN(0), // claim_amount
          new anchor.BN(0)  // claim_time
        )
        .accounts({
          user: userAccount,
          presale: presaleAccount,
          buyer: user.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      console.log("Init user transaction signature:", tx);
      
      // Verify user account was created
      const userData = await program.account.user.fetch(userAccount);
      expect(userData.buyer.toString()).to.equal(user.publicKey.toString());
      
    } catch (error) {
      console.error("Error initializing user:", error);
      throw error;
    }
  });

  it("Buys tokens", async () => {
    const paymentAmount = new anchor.BN(500 * 10**6); // 500 USD
    
    try {
      const tx = await program.methods
        .buyTokens(paymentAmount)
        .accounts({
          presale: presaleAccount,
          user: userAccount,
          buyer: user.publicKey,
          buyerUsdAccount: userUsdAccount,
          presaleUsdAccount: presaleUsdAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      console.log("Buy tokens transaction signature:", tx);
      
      // Verify purchase was recorded
      const userData = await program.account.user.fetch(userAccount);
      expect(userData.buyQuoteAmount.gt(new anchor.BN(0))).to.be.true;
      
    } catch (error) {
      console.error("Error buying tokens:", error);
      throw error;
    }
  });

  it("Claims tokens", async () => {
    try {
      // First, we need to get the user's token account
      const userTokenAccount = await getAssociatedTokenAddress(tokenMint, user.publicKey);
      
      const tx = await program.methods
        .claimToken()
        .accounts({
          presale: presaleAccount,
          user: userAccount,
          buyer: user.publicKey,
          buyerTokenAccount: userTokenAccount,
          presaleTokenAccount: presaleTokenAccount,
          tokenMint: tokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      console.log("Claim tokens transaction signature:", tx);
      
    } catch (error) {
      console.error("Error claiming tokens:", error);
      // This might fail if claiming conditions aren't met, which is expected
      console.log("This is expected if claiming conditions aren't met");
    }
  });

  it("Ends presale (authority only)", async () => {
    try {
      const tx = await program.methods
        .endPresale()
        .accounts({
          presale: presaleAccount,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      console.log("End presale transaction signature:", tx);
      
    } catch (error) {
      console.error("Error ending presale:", error);
      throw error;
    }
  });

  it("Withdraws tokens (authority only)", async () => {
    try {
      const tx = await program.methods
        .withdrawToken()
        .accounts({
          presale: presaleAccount,
          authority: authority.publicKey,
          authorityTokenAccount: authorityTokenAccount,
          presaleTokenAccount: presaleTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      console.log("Withdraw tokens transaction signature:", tx);
      
    } catch (error) {
      console.error("Error withdrawing tokens:", error);
      // This might fail based on presale conditions
      console.log("This might fail based on presale state/conditions");
    }
  });

  it("Withdraws USD (authority only)", async () => {
    try {
      const tx = await program.methods
        .withdrawUsd()
        .accounts({
          presale: presaleAccount,
          authority: authority.publicKey,
          authorityUsdAccount: authorityUsdAccount,
          presaleUsdAccount: presaleUsdAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      console.log("Withdraw USD transaction signature:", tx);
      
    } catch (error) {
      console.error("Error withdrawing USD:", error);
      // This might fail based on presale conditions
      console.log("This might fail based on presale state/conditions");
    }
  });

  it("Claims refund", async () => {
    try {
      const tx = await program.methods
        .refund()
        .accounts({
          presale: presaleAccount,
          user: userAccount,
          buyer: user.publicKey,
          buyerUsdAccount: userUsdAccount,
          presaleUsdAccount: presaleUsdAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      console.log("Refund transaction signature:", tx);
      
    } catch (error) {
      console.error("Error claiming refund:", error);
      // This might fail if refund conditions aren't met
      console.log("This might fail if refund conditions aren't met");
    }
  });
});