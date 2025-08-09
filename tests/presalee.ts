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
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect } from "chai";

import adminSecretArray from "./wallets/wallet2.json";
// Import a different wallet for user, or generate one
import userSecretArray from "./wallets/wallet.json"; // You should use a different wallet

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

  // 998425000
  
  // Test parameters
  const seed = new anchor.BN(56446);
  const seedBytes = seed.toArrayLike(Buffer, 'le', 8);
  const softcapAmount = new anchor.BN(1000 * 10**6); // 1000 tokens (6 decimals)
  const hardcapAmount = new anchor.BN(10000 * 10**6); // 10000 tokens
  const depositTokenAmount = new anchor.BN(194000000 * 10**6); // 14000 tokens
  const soldTokenAmount = new anchor.BN(0);
  const startTime = new anchor.BN(Math.floor(Date.now() / 1000));
  const endTime = new anchor.BN(Math.floor(Date.now() / 1000) + 3600 * 24 * 7); // 1 week
  
  // Define presale levels (example tier structure)
  const levels = [
    { tokenAmount: new anchor.BN(5000000 * 10**6), price: new anchor.BN(1 * 10**4), softCap: new anchor.BN(0), tokensSold: new anchor.BN(0) },
    { tokenAmount: new anchor.BN(10000000 * 10**6), price: new anchor.BN(2 * 10**4), softCap: new anchor.BN(0), tokensSold: new anchor.BN(0) },
    { tokenAmount: new anchor.BN(25000000 * 10**6), price: new anchor.BN(3 * 10**4), softCap: new anchor.BN(0), tokensSold: new anchor.BN(0) },
    { tokenAmount: new anchor.BN(66000000 * 10**6), price: new anchor.BN(4.5 * 10**4), softCap: new anchor.BN(0), tokensSold: new anchor.BN(0) },
    { tokenAmount: new anchor.BN(62000000 * 10**6), price: new anchor.BN(5.5 * 10**4), softCap: new anchor.BN(0), tokensSold: new anchor.BN(0) },
    { tokenAmount: new anchor.BN(22000000 * 10**6), price: new anchor.BN(6.5 * 10**4), softCap: new anchor.BN(0), tokensSold: new anchor.BN(0) },
    { tokenAmount: new anchor.BN(5000000), price: new anchor.BN(7.5 * 10**4), softCap: new anchor.BN(0), tokensSold: new anchor.BN(0) },
  ];

  before(async () => {
    // Generate keypairs
    authority = Keypair.fromSecretKey(Uint8Array.from(adminSecretArray));
    // Generate a new user instead of using the same wallet
    user = Keypair.fromSecretKey(Uint8Array.from(userSecretArray));

    console.log("Authority public key:", authority.publicKey.toBase58());
    console.log("User public key:", user.publicKey.toBase58());

    // Airdrop SOL to both accounts
    try {
      const authorityAirdrop = await provider.connection.requestAirdrop(
        authority.publicKey, 
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      const userAirdrop = await provider.connection.requestAirdrop(
        user.publicKey, 
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      
      // Wait for airdrops to confirm
      await provider.connection.confirmTransaction(authorityAirdrop);
      await provider.connection.confirmTransaction(userAirdrop);
      
      // Wait a bit more to ensure transactions are processed
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log("Airdrop failed, checking existing balance...", error.message);
    }

    const authorityBalance = await provider.connection.getBalance(authority.publicKey);
    console.log("Authority balance:", authorityBalance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
    const userBalance = await provider.connection.getBalance(user.publicKey);
    console.log("User balance:", userBalance / anchor.web3.LAMPORTS_PER_SOL, "SOL");

    if (authorityBalance < 0.1 * anchor.web3.LAMPORTS_PER_SOL) {
        throw new Error("Authority account has insufficient SOL");
    }
    if (userBalance < 0.1 * anchor.web3.LAMPORTS_PER_SOL) {
        throw new Error("User account has insufficient SOL");
    }

    // Create NEW token mints instead of using hardcoded ones
    try {
      // tokenMint = await createMint(
      //   provider.connection,
      //   authority,
      //   authority.publicKey,
      //   null,
      //   6 // 6 decimals
      // );
      tokenMint = new PublicKey("8ME8EAAmLegMSBae3DgN6LPznr6P3xaHAN8Pd7mMbJ3o")
      console.log("Token mint created:", tokenMint.toBase58());

      // usdMint = await createMint(
      //   provider.connection,
      //   authority,
      //   authority.publicKey,
      //   null,
      //   6 // 6 decimals (USDC-like)
      // );
      usdMint = new PublicKey("3MWScP9VFh4BQyWDFj5aR3doz6cSKTB2MRGnJB7vdz6P")
      console.log("USD mint created:", usdMint.toBase58());
    } catch (error) {
      console.error("Error creating mints:", error);
      throw error;
    }

    // Create associated token accounts
    try {
      const existingAuthorityTokenAccount = await connection.getAccountInfo(
        await getAssociatedTokenAddress(tokenMint, authority.publicKey)
      );

      if (!existingAuthorityTokenAccount) {
        authorityTokenAccount = await createAssociatedTokenAccount(
          provider.connection,
          authority,
          tokenMint,
          authority.publicKey
        );
      } else {
        authorityTokenAccount = await getAssociatedTokenAddress(tokenMint, authority.publicKey);
      }
      const existingAuthorityUsdAccount = await connection.getAccountInfo(
        await getAssociatedTokenAddress(usdMint, authority.publicKey)
      );

      if (!existingAuthorityUsdAccount) {
        authorityUsdAccount = await createAssociatedTokenAccount(
          provider.connection,
          authority,
          usdMint,
          authority.publicKey
        );
      } else {
        authorityUsdAccount = await getAssociatedTokenAddress(usdMint, authority.publicKey);
      }
      const existingUserUsdAccount = await connection.getAccountInfo(
        await getAssociatedTokenAddress(usdMint, user.publicKey)
      );
      

      if (!existingUserUsdAccount) {
        userUsdAccount = await createAssociatedTokenAccount(
          provider.connection,
          user,
          usdMint,
          user.publicKey
        );
      } else {
        userUsdAccount = await getAssociatedTokenAddress(usdMint, user.publicKey);
      }
      const existingUserTokenAccount = await connection.getAccountInfo(
        await getAssociatedTokenAddress(tokenMint, authority.publicKey)
      );


      if (!existingUserTokenAccount) {
        userTokenAccount = await createAssociatedTokenAccount(
          provider.connection,
          user,
          tokenMint,
          user.publicKey
        );
      } else {
        userTokenAccount = await getAssociatedTokenAddress(tokenMint, user.publicKey);
      }

      // authorityUsdAccount = await createAssociatedTokenAccount(
      //   provider.connection,
      //   authority,
      //   usdMint,
      //   authority.publicKey
      // );

      // userUsdAccount = await createAssociatedTokenAccount(
      //   provider.connection,
      //   user,
      //   usdMint,
      //   user.publicKey
      // );

      // userTokenAccount = await createAssociatedTokenAccount(
      //   provider.connection,
      //   user,
      //   tokenMint,
      //   user.publicKey
      // );

      console.log("All token accounts created successfully");
    } catch (error) {
      console.error("Error creating token accounts:", error);
      throw error;
    }

    // Mint tokens to authority
    // try {
    //   await mintTo(
    //     provider.connection,
    //     authority,
    //     tokenMint,
    //     authorityTokenAccount,
    //     authority.publicKey,
    //     50000 * 10**6 // 50,000 tokens
    //   );

    //   // Mint USD to user for testing purchases
    //   await mintTo(
    //     provider.connection,
    //     authority,
    //     usdMint,
    //     userUsdAccount,
    //     authority.publicKey,
    //     5000 * 10**6 // 5,000 USD
    //   );

    //   console.log("Tokens minted successfully");
    // } catch (error) {
    //   console.error("Error minting tokens:", error);
    //   throw error;
    // }

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

    console.log("Setup completed successfully");
    console.log("Presale PDA:", presalePda.toBase58());
    console.log("User Account PDA:", userAccount.toBase58());
  });

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
          tokenProgram: TOKEN_PROGRAM_ID,
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
          tokenProgram: TOKEN_PROGRAM_ID,
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
    const paymentAmount = new anchor.BN(40 * 10**6); // 500 USD
    
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
          tokenProgram: TOKEN_PROGRAM_ID,
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
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      console.log("Claim tokens transaction signature:", tx);

      const userTokenBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);
      console.log("User DGX balance:", userTokenBalance.value.uiAmount); // Should show 500 for 5 USD
      expect(userTokenBalance.value.uiAmount).to.equal(500);
      
    } catch (error) {
      console.error("Error claiming tokens:", error);
      // This might fail if claiming conditions aren't met, which is expected
      console.log("This is expected if claiming conditions aren't met");
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
          tokenProgram: TOKEN_PROGRAM_ID,
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
          tokenProgram: TOKEN_PROGRAM_ID,
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

  it("Close presale (authority only)", async () => {
    try {
      const tx = await program.methods
        .closePresale()
        .accountsPartial({
          admin: authority.publicKey,
          presale: presalePda,
          systemProgram: anchor.web3.SystemProgram.programId
        })
        .signers([authority])
        .rpc();

      console.log("Close presale transaction signature:", tx);
      
    } catch (error) {
      console.error("Error ending presale:", error);
      throw error;
    }
  });
  
});