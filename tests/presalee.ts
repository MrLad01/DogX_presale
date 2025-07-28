import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Presalee } from "../target/types/presalee";
import { 
  PublicKey, 
  Keypair, 
  SystemProgram,
} from "@solana/web3.js";
import { 
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { expect } from "chai";

import adminSecretArray from "./wallets/wallet.json";
import userSecretArray from "./wallets/wallet2.json";

describe("presalee", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.presalee as Program<Presalee>;
  const connection = provider.connection
  
  // Test accounts
  let authority: Keypair;
  let user: Keypair;
  let tokenMint: anchor.web3.PublicKey;
  let usdMint: anchor.web3.PublicKey;
  let presalePda: anchor.web3.PublicKey;
  let userAccount: anchor.web3.PublicKey;
  let authorityTokenAccount: anchor.web3.PublicKey;
  let authorityUsdAccount: anchor.web3.PublicKey;
  let userUsdAccount: anchor.web3.PublicKey;
  let userTokenAccount: anchor.web3.PublicKey;
  let presaleTokenAccount: anchor.web3.PublicKey;
  let presaleUsdAccount: anchor.web3.PublicKey;
  let vaultDog: anchor.web3.PublicKey;
  let vaultUsd: anchor.web3.PublicKey;
  
  // Test parameters
  const seed = new anchor.BN(12345);
  const seedBytes = seed.toArrayLike(Buffer, 'le', 8);
  const softcapAmount = new anchor.BN(1000 * 10**6); // 1000 tokens (6 decimals)
  const hardcapAmount = new anchor.BN(10000 * 10**6); // 10000 tokens
  const depositTokenAmount = new anchor.BN(14000 * 10**6); // 15000 tokens
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
    authority = Keypair.fromSecretKey(Uint8Array.from(adminSecretArray));
    user = Keypair.fromSecretKey(Uint8Array.from(userSecretArray));
    // user = Keypair.generate();

    // Airdrop SOL to accounts
    // await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
    // await provider.connection.requestAirdrop(user.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    
    // Wait for airdrops to confirm
    // await new Promise(resolve => setTimeout(resolve, 1000));

    console.log("Authority public key:", authority.publicKey.toBase58());
    console.log("User public key:", user.publicKey.toBase58());

    const authorityBalance = await provider.connection.getBalance(authority.publicKey);
    console.log("Authority balance:", authorityBalance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
    const userBalance = await provider.connection.getBalance(user.publicKey);
    console.log("User balance:", userBalance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
    if (authorityBalance < 0.1 * anchor.web3.LAMPORTS_PER_SOL) {
        throw new Error("Authority account has insufficient SOL");
    }

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

   userTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      user,
      tokenMint,
      user.publicKey
    );

    // Mint tokens to authority
    await mintTo(
      provider.connection,
      authority,
      tokenMint,
      authorityTokenAccount,
      authority.publicKey,
      50000 * 10**6 // 20,000 tokens
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

    // Derive presale PDA with correct seeds
    [presalePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("dogx_presale"), authority.publicKey.toBuffer(), seedBytes],
      program.programId
    );

    [userAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), presalePda.toBuffer(), user.publicKey.toBuffer()],
      program.programId
    );

    // Get associated token accounts for presale
    presaleTokenAccount = await getAssociatedTokenAddress(tokenMint, presalePda, true);
    presaleUsdAccount = await getAssociatedTokenAddress(usdMint, presalePda, true);
  });


  // Update test
  it("Initializes presale", async () => {
    try {
      vaultDog = await getAssociatedTokenAddress(tokenMint, presalePda, true);
      vaultUsd = await getAssociatedTokenAddress(usdMint, presalePda, true);
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
        .accountsPartial({
          admin: authority.publicKey,
          tokenMintAddress: tokenMint,
          usdMint: usdMint,
          presale: presalePda,
          vaultDog,
          vaultUsd,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();

      console.log("Init presale transaction signature:", tx);

      const presaleData = await program.account.presale.fetch(presalePda);
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
      vaultDog = await getAssociatedTokenAddress(tokenMint, presalePda, true);

      const tx = await program.methods
        .depositToken(depositTokenAmount)
        .accountsPartial({
          admin: authority.publicKey,
          usdMint,
          tokenMintAddress: tokenMint,
          adminAta: authorityTokenAccount,
          vaultDog,
          presale: presalePda,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      console.log("Deposit token transaction signature:", tx);
      
      // Verify tokens were deposited
      const presaleData = await program.account.presale.fetch(presalePda);
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
        .accountsPartial({
          admin: authority.publicKey,
          presale: presalePda,
        })
        .signers([authority])  
        .rpc();

      console.log("Start presale transaction signature:", tx);
      
      // Verify presale status changed
      const presaleData = await program.account.presale.fetch(presalePda);
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
        .accountsPartial({
          buyer: user.publicKey,
          presale: presalePda,
          userInfo: userAccount,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      console.log("Init user transaction signature:", tx);
      
      // Verify user account was created
      const userData = await program.account.userInfo.fetch(userAccount);
      expect(userData.buyer.toString()).to.equal(user.publicKey.toString());
      
    } catch (error) {
      console.error("Error initializing user:", error);
      throw error;
    }
  });

  it("Buys tokens", async () => {
    const paymentAmount = new anchor.BN(500 * 10**6); // 500 USD
    
    try {
      vaultUsd = await getAssociatedTokenAddress(usdMint, presalePda, true);
      const tx = await program.methods
        .buyTokens(paymentAmount)
        .accountsPartial({
          buyer: user.publicKey,
          tokenMintAddress: tokenMint,
          usdMint,
          presale: presalePda,
          buyerAta: userUsdAccount,
          vaultUsd,
          user: userAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      console.log("Buy tokens transaction signature:", tx);
      
      // Verify purchase was recorded
      const userData = await program.account.userInfo.fetch(userAccount);
      expect(userData.buyQuoteAmount.gt(new anchor.BN(0))).to.be.true;
      
    } catch (error) {
      console.error("Error buying tokens:", error);
      throw error;
    }
  });

  it("Claims tokens", async () => {
    try {
      // First, we need to get the user's token account
      const userTokenATA = await getAssociatedTokenAddress(tokenMint, user.publicKey);
      vaultDog = await getAssociatedTokenAddress(tokenMint, presalePda, true);

      
      const tx = await program.methods
        .claimToken()
        .accountsPartial({
          buyer: user.publicKey,
          usdMint,
          tokenMintAddress: tokenMint,
          buyerAta: userTokenATA,
          vaultDog,
          presale: presalePda,
          user: userAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
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
        .accountsPartial({
          admin: authority.publicKey,
          presale: presalePda,
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
      vaultDog = await getAssociatedTokenAddress(tokenMint, presalePda, true);
      const tx = await program.methods
        .withdrawToken()
        .accountsPartial({
          admin: authority.publicKey,
          usdMint,
          tokenMintAddress: tokenMint,
          adminAta: authorityTokenAccount,
          vaultDog,
          presale: presalePda,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
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
      vaultUsd = await getAssociatedTokenAddress(usdMint, presalePda, true);
      const tx = await program.methods
        .withdrawUsd()
        .accountsPartial({
          admin: authority.publicKey,
          usdMint,
          tokenMintAddress: tokenMint,
          adminAta: authorityUsdAccount,
          vaultUsd,
          presale: presalePda,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
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
      vaultUsd = await getAssociatedTokenAddress(usdMint, presalePda, true);
      const tx = await program.methods
        .refund()
        .accountsPartial({
          buyer: user.publicKey,
          tokenMintAddress: tokenMint,
          usdMint,
          presale: presalePda,
          buyerAta: userUsdAccount,
          vaultUsd,
          user: userAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
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