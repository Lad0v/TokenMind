import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Keypair, ParsedAccountData, PublicKey, SystemProgram } from "@solana/web3.js";
import { TokenizationContracts } from "../target/types/tokenization_contracts";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

const getErrorCode = (err: any): string | undefined => err?.error?.errorCode?.code;

describe("tokenization_contracts", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.tokenizationContracts as Program<TokenizationContracts>;

  const issuer = provider.wallet;

  const findAssetConfigPda = (issuerPk: PublicKey, assetId: string): PublicKey =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("asset"), issuerPk.toBuffer(), Buffer.from(assetId)],
      program.programId
    )[0];

  const findMintAuthPda = (assetConfig: PublicKey): PublicKey =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("mint-auth"), assetConfig.toBuffer()],
      program.programId
    )[0];

  const findFractionConfigPda = (assetConfig: PublicKey): PublicKey =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("fraction"), assetConfig.toBuffer()],
      program.programId
    )[0];

  const findVaultAuthorityPda = (fractionConfig: PublicKey): PublicKey =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("vault-auth"), fractionConfig.toBuffer()],
      program.programId
    )[0];

  const findListingPda = (fractionConfig: PublicKey): PublicKey =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), fractionConfig.toBuffer()],
      program.programId
    )[0];

  const findTradeReceiptPda = (listing: PublicKey, tradeIndex: anchor.BN): PublicKey =>
    PublicKey.findProgramAddressSync(
      [
        Buffer.from("trade"),
        listing.toBuffer(),
        tradeIndex.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0];

  const setupMintedAsset = async (assetId: string, totalShares: number, saleSupply: number) => {
    const totalSharesBn = new anchor.BN(totalShares);
    const saleSupplyBn = new anchor.BN(saleSupply);

    const assetConfig = findAssetConfigPda(issuer.publicKey, assetId);
    const mint = Keypair.generate();
    const mintAuthority = findMintAuthPda(assetConfig);
    const issuerTokenAccount = await anchor.utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: issuer.publicKey,
    });

    await program.methods
      .initializeAsset(assetId, totalSharesBn, saleSupplyBn)
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .mintAssetTokens(assetId)
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        mint: mint.publicKey,
        issuerTokenAccount,
        mintAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([mint])
      .rpc();

    return { assetConfig, mint, mintAuthority, issuerTokenAccount, totalSharesBn };
  };

  const createFundedKeypair = async (lamports: number): Promise<Keypair> => {
    const keypair = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(keypair.publicKey, lamports);
    await provider.connection.confirmTransaction(sig);
    return keypair;
  };

  const setupLockedFraction = async (
    assetId: string,
    totalShares: number,
    saleSupply: number,
    issuerReserve: number,
    platformReserve: number
  ) => {
    const { assetConfig, mint, issuerTokenAccount } = await setupMintedAsset(assetId, totalShares, 0);
    const fractionConfig = findFractionConfigPda(assetConfig);
    const vaultAuthority = findVaultAuthorityPda(fractionConfig);
    const saleVault = await anchor.utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: vaultAuthority,
    });

    await program.methods
      .configureFractionalization(
        assetId,
        new anchor.BN(saleSupply),
        new anchor.BN(issuerReserve),
        new anchor.BN(platformReserve)
      )
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        fractionConfig,
        mint: mint.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .depositSaleSupply(assetId)
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        fractionConfig,
        issuerTokenAccount,
        saleVault,
        vaultAuthority,
        mint: mint.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .lockFractionModel(assetId)
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        fractionConfig,
      })
      .rpc();

    return { assetConfig, fractionConfig, mint, vaultAuthority, saleVault };
  };

  it("creates asset, mints fixed supply, revokes mint authority", async () => {
    const assetId = `a-pos-${Date.now()}`;
    const totalShares = new anchor.BN(1_000);
    const saleSupply = new anchor.BN(400);

    const assetConfig = findAssetConfigPda(issuer.publicKey, assetId);

    await program.methods
      .initializeAsset(assetId, totalShares, saleSupply)
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const initialized = await program.account.assetConfig.fetch(assetConfig);
    expect(initialized.assetId).to.equal(assetId);
    expect(initialized.issuer.toBase58()).to.equal(issuer.publicKey.toBase58());
    expect(initialized.mint.toBase58()).to.equal(PublicKey.default.toBase58());
    expect(initialized.totalShares.toString()).to.equal(totalShares.toString());
    expect(initialized.mintedSupply.toString()).to.equal("0");
    expect(initialized.saleSupply.toString()).to.equal(saleSupply.toString());
    expect(initialized.isMinted).to.equal(false);

    const mint = Keypair.generate();
    const issuerTokenAccount = await anchor.utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: issuer.publicKey,
    });
    const mintAuthority = findMintAuthPda(assetConfig);

    await program.methods
      .mintAssetTokens(assetId)
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        mint: mint.publicKey,
        issuerTokenAccount,
        mintAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([mint])
      .rpc();

    const mintedState = await program.account.assetConfig.fetch(assetConfig);
    expect(mintedState.isMinted).to.equal(true);
    expect(mintedState.mintedSupply.toString()).to.equal(totalShares.toString());
    expect(mintedState.mint.toBase58()).to.equal(mint.publicKey.toBase58());

    const issuerBalance = await provider.connection.getTokenAccountBalance(issuerTokenAccount);
    expect(issuerBalance.value.amount).to.equal(totalShares.toString());

    await program.methods
      .revokeMintAuthority(assetId)
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        mint: mint.publicKey,
        mintAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const parsedMintInfo = await provider.connection.getParsedAccountInfo(mint.publicKey);
    const parsedMint = (parsedMintInfo.value?.data as ParsedAccountData).parsed.info;
    expect(parsedMint.mintAuthority).to.equal(null);

    const secondMint = Keypair.generate();
    const secondIssuerTokenAccount = await anchor.utils.token.associatedAddress({
      mint: secondMint.publicKey,
      owner: issuer.publicKey,
    });

    try {
      await program.methods
        .mintAssetTokens(assetId)
        .accounts({
          issuer: issuer.publicKey,
          assetConfig,
          mint: secondMint.publicKey,
          issuerTokenAccount: secondIssuerTokenAccount,
          mintAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([secondMint])
        .rpc();
      expect.fail("second mint must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("AlreadyMinted");
    }
  });

  it("fails when total_shares is zero", async () => {
    const assetId = `a-zero-${Date.now()}`;
    const assetConfig = findAssetConfigPda(issuer.publicKey, assetId);

    try {
      await program.methods
        .initializeAsset(assetId, new anchor.BN(0), new anchor.BN(0))
        .accounts({
          issuer: issuer.publicKey,
          assetConfig,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("initialize with total_shares=0 must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("InvalidTotalShares");
    }
  });

  it("fails when sale_supply exceeds total_shares", async () => {
    const assetId = `a-sale-${Date.now()}`;
    const assetConfig = findAssetConfigPda(issuer.publicKey, assetId);

    try {
      await program.methods
        .initializeAsset(assetId, new anchor.BN(10), new anchor.BN(11))
        .accounts({
          issuer: issuer.publicKey,
          assetConfig,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("initialize with sale_supply > total_shares must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("InvalidSaleSupply");
    }
  });

  it("rejects mint and revoke for non-issuer", async () => {
    const assetId = `a-unauth-${Date.now()}`;
    const totalShares = new anchor.BN(25);
    const saleSupply = new anchor.BN(5);

    const assetConfig = findAssetConfigPda(issuer.publicKey, assetId);

    await program.methods
      .initializeAsset(assetId, totalShares, saleSupply)
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const attacker = Keypair.generate();
    const airdropSig = await provider.connection.requestAirdrop(attacker.publicKey, 2_000_000_000);
    await provider.connection.confirmTransaction(airdropSig);

    const mint = Keypair.generate();
    const attackerAta = await anchor.utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: attacker.publicKey,
    });
    const mintAuthority = findMintAuthPda(assetConfig);

    try {
      await program.methods
        .mintAssetTokens(assetId)
        .accounts({
          issuer: attacker.publicKey,
          assetConfig,
          mint: mint.publicKey,
          issuerTokenAccount: attackerAta,
          mintAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker, mint])
        .rpc();
      expect.fail("mint by non-issuer must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("UnauthorizedIssuer");
    }

    const mintByIssuer = Keypair.generate();
    const issuerAta = await anchor.utils.token.associatedAddress({
      mint: mintByIssuer.publicKey,
      owner: issuer.publicKey,
    });

    await program.methods
      .mintAssetTokens(assetId)
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        mint: mintByIssuer.publicKey,
        issuerTokenAccount: issuerAta,
        mintAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([mintByIssuer])
      .rpc();

    try {
      await program.methods
        .revokeMintAuthority(assetId)
        .accounts({
          issuer: attacker.publicKey,
          assetConfig,
          mint: mintByIssuer.publicKey,
          mintAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([attacker])
        .rpc();
      expect.fail("revoke by non-issuer must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("UnauthorizedIssuer");
    }
  });

  it("configures fractionalization, deposits sale supply to vault, and locks model", async () => {
    const assetId = `a-fr-pos-${Date.now()}`;
    const { assetConfig, mint, issuerTokenAccount } = await setupMintedAsset(assetId, 100, 0);

    const fractionConfig = findFractionConfigPda(assetConfig);
    const vaultAuthority = findVaultAuthorityPda(fractionConfig);
    const saleVault = await anchor.utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: vaultAuthority,
    });

    await program.methods
      .configureFractionalization(assetId, new anchor.BN(60), new anchor.BN(30), new anchor.BN(10))
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        fractionConfig,
        mint: mint.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const configured = await program.account.fractionConfig.fetch(fractionConfig);
    expect(configured.asset.toBase58()).to.equal(assetConfig.toBase58());
    expect(configured.mint.toBase58()).to.equal(mint.publicKey.toBase58());
    expect(configured.totalShares.toString()).to.equal("100");
    expect(configured.saleSupply.toString()).to.equal("60");
    expect(configured.issuerReserve.toString()).to.equal("30");
    expect(configured.platformReserve.toString()).to.equal("10");
    expect(configured.saleDeposited).to.equal(false);
    expect(configured.isLocked).to.equal(false);

    await program.methods
      .depositSaleSupply(assetId)
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        fractionConfig,
        issuerTokenAccount,
        saleVault,
        vaultAuthority,
        mint: mint.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const afterDeposit = await program.account.fractionConfig.fetch(fractionConfig);
    expect(afterDeposit.saleDeposited).to.equal(true);

    const vaultBalance = await provider.connection.getTokenAccountBalance(saleVault);
    expect(vaultBalance.value.amount).to.equal("60");
    const issuerBalance = await provider.connection.getTokenAccountBalance(issuerTokenAccount);
    expect(issuerBalance.value.amount).to.equal("40");

    await program.methods
      .lockFractionModel(assetId)
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        fractionConfig,
      })
      .rpc();

    const locked = await program.account.fractionConfig.fetch(fractionConfig);
    expect(locked.isLocked).to.equal(true);

    try {
      await program.methods
        .configureFractionalization(assetId, new anchor.BN(60), new anchor.BN(30), new anchor.BN(10))
        .accounts({
          issuer: issuer.publicKey,
          assetConfig,
          fractionConfig,
          mint: mint.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("configure after lock must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("FractionModelLocked");
    }
  });

  it("fails to configure fractionalization before asset mint", async () => {
    const assetId = `a-fr-nm-${Date.now()}`;
    const assetConfig = findAssetConfigPda(issuer.publicKey, assetId);
    const fractionConfig = findFractionConfigPda(assetConfig);
    const { mint: existingMint } = await setupMintedAsset(`a-fr-ref-${Date.now()}`, 10, 0);

    await program.methods
      .initializeAsset(assetId, new anchor.BN(50), new anchor.BN(0))
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    try {
      await program.methods
        .configureFractionalization(assetId, new anchor.BN(20), new anchor.BN(20), new anchor.BN(10))
        .accounts({
          issuer: issuer.publicKey,
          assetConfig,
          fractionConfig,
          mint: existingMint.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("configure before mint must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("AssetNotMinted");
    }
  });

  it("validates fractional allocation invariants", async () => {
    const assetId = `a-fr-inv-${Date.now()}`;
    const { assetConfig, mint } = await setupMintedAsset(assetId, 100, 0);
    const fractionConfig = findFractionConfigPda(assetConfig);

    try {
      await program.methods
        .configureFractionalization(assetId, new anchor.BN(0), new anchor.BN(90), new anchor.BN(10))
        .accounts({
          issuer: issuer.publicKey,
          assetConfig,
          fractionConfig,
          mint: mint.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("sale_supply=0 must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("InvalidSaleSupply");
    }

    try {
      await program.methods
        .configureFractionalization(assetId, new anchor.BN(60), new anchor.BN(30), new anchor.BN(9))
        .accounts({
          issuer: issuer.publicKey,
          assetConfig,
          fractionConfig,
          mint: mint.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("sum mismatch must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("InvalidFractionAllocation");
    }
  });

  it("enforces deposit/lock ordering and single deposit", async () => {
    const assetId = `a-fr-dep-${Date.now()}`;
    const { assetConfig, mint, issuerTokenAccount } = await setupMintedAsset(assetId, 100, 0);

    const fractionConfig = findFractionConfigPda(assetConfig);
    const vaultAuthority = findVaultAuthorityPda(fractionConfig);
    const saleVault = await anchor.utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: vaultAuthority,
    });

    await program.methods
      .configureFractionalization(assetId, new anchor.BN(55), new anchor.BN(35), new anchor.BN(10))
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        fractionConfig,
        mint: mint.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    try {
      await program.methods
        .lockFractionModel(assetId)
        .accounts({
          issuer: issuer.publicKey,
          assetConfig,
          fractionConfig,
        })
        .rpc();
      expect.fail("lock before deposit must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("SaleNotDeposited");
    }

    await program.methods
      .depositSaleSupply(assetId)
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        fractionConfig,
        issuerTokenAccount,
        saleVault,
        vaultAuthority,
        mint: mint.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    try {
      await program.methods
        .depositSaleSupply(assetId)
        .accounts({
          issuer: issuer.publicKey,
          assetConfig,
          fractionConfig,
          issuerTokenAccount,
          saleVault,
          vaultAuthority,
          mint: mint.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("second deposit must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("SaleAlreadyDeposited");
    }
  });

  it("rejects fractionalization actions for non-issuer", async () => {
    const assetId = `a-fr-una-${Date.now()}`;
    const { assetConfig, mint, issuerTokenAccount } = await setupMintedAsset(assetId, 100, 0);

    const fractionConfig = findFractionConfigPda(assetConfig);
    const vaultAuthority = findVaultAuthorityPda(fractionConfig);
    const saleVault = await anchor.utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: vaultAuthority,
    });

    await program.methods
      .configureFractionalization(assetId, new anchor.BN(50), new anchor.BN(40), new anchor.BN(10))
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        fractionConfig,
        mint: mint.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const attacker = Keypair.generate();
    const airdropSig = await provider.connection.requestAirdrop(attacker.publicKey, 2_000_000_000);
    await provider.connection.confirmTransaction(airdropSig);

    try {
      await program.methods
        .configureFractionalization(assetId, new anchor.BN(50), new anchor.BN(30), new anchor.BN(20))
        .accounts({
          issuer: attacker.publicKey,
          assetConfig,
          fractionConfig,
          mint: mint.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc();
      expect.fail("configure by non-issuer must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("UnauthorizedIssuer");
    }

    try {
      await program.methods
        .depositSaleSupply(assetId)
        .accounts({
          issuer: attacker.publicKey,
          assetConfig,
          fractionConfig,
          issuerTokenAccount,
          saleVault,
          vaultAuthority,
          mint: mint.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc();
      expect.fail("deposit by non-issuer must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("UnauthorizedIssuer");
    }

    try {
      await program.methods
        .lockFractionModel(assetId)
        .accounts({
          issuer: attacker.publicKey,
          assetConfig,
          fractionConfig,
        })
        .signers([attacker])
        .rpc();
      expect.fail("lock by non-issuer must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("UnauthorizedIssuer");
    }
  });

  it("creates listing and executes buy settlement with receipt", async () => {
    const assetId = `a-list-buy-${Date.now()}`;
    const { assetConfig, fractionConfig, mint, vaultAuthority, saleVault } =
      await setupLockedFraction(assetId, 100, 60, 30, 10);

    const listing = findListingPda(fractionConfig);
    const platformTreasury = (await createFundedKeypair(1_000_000)).publicKey;

    const now = Math.floor(Date.now() / 1000);
    const startTs = new anchor.BN(now - 60);
    const endTs = new anchor.BN(now + 600);
    const unitPrice = new anchor.BN(1_000_000);
    const feeBps = 500;

    await program.methods
      .createListing(assetId, unitPrice, startTs, endTs, feeBps)
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        fractionConfig,
        listing,
        saleVault,
        vaultAuthority,
        mint: mint.publicKey,
        platformTreasury,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const buyer = await createFundedKeypair(2_000_000_000);
    const buyerTokenAccount = await anchor.utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: buyer.publicKey,
    });

    const tradeReceipt = findTradeReceiptPda(listing, new anchor.BN(0));

    const issuerBefore = await provider.connection.getBalance(issuer.publicKey);
    const treasuryBefore = await provider.connection.getBalance(platformTreasury);

    await program.methods
      .buyShares(new anchor.BN(10))
      .accounts({
        buyer: buyer.publicKey,
        listing,
        tradeReceipt,
        fractionConfig,
        saleVault,
        vaultAuthority,
        buyerTokenAccount,
        issuer: issuer.publicKey,
        platformTreasury,
        mint: mint.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const listingAfter = await program.account.listingState.fetch(listing);
    expect(listingAfter.remainingSupply.toString()).to.equal("50");
    expect(listingAfter.tradeCount.toString()).to.equal("1");
    expect(listingAfter.isActive).to.equal(true);

    const buyerTokenBalance = await provider.connection.getTokenAccountBalance(buyerTokenAccount);
    expect(buyerTokenBalance.value.amount).to.equal("10");
    const vaultBalance = await provider.connection.getTokenAccountBalance(saleVault);
    expect(vaultBalance.value.amount).to.equal("50");

    const receipt = await program.account.tradeReceipt.fetch(tradeReceipt);
    expect(receipt.qty.toString()).to.equal("10");
    expect(receipt.unitPriceLamports.toString()).to.equal(unitPrice.toString());
    expect(receipt.grossAmountLamports.toString()).to.equal("10000000");
    expect(receipt.feeAmountLamports.toString()).to.equal("500000");
    expect(receipt.netAmountLamports.toString()).to.equal("9500000");

    const issuerAfter = await provider.connection.getBalance(issuer.publicKey);
    const treasuryAfter = await provider.connection.getBalance(platformTreasury);
    expect(issuerAfter - issuerBefore).to.be.greaterThan(9_400_000);
    expect(issuerAfter - issuerBefore).to.be.lessThanOrEqual(9_500_000);
    expect(treasuryAfter - treasuryBefore).to.equal(500_000);
  });

  it("marks listing inactive after full sellout", async () => {
    const assetId = `a-list-out-${Date.now()}`;
    const { assetConfig, fractionConfig, mint, vaultAuthority, saleVault } =
      await setupLockedFraction(assetId, 30, 12, 10, 8);

    const listing = findListingPda(fractionConfig);
    const platformTreasury = (await createFundedKeypair(1_000_000)).publicKey;

    const now = Math.floor(Date.now() / 1000);
    await program.methods
      .createListing(assetId, new anchor.BN(500_000), new anchor.BN(now - 10), new anchor.BN(now + 600), 0)
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        fractionConfig,
        listing,
        saleVault,
        vaultAuthority,
        mint: mint.publicKey,
        platformTreasury,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const buyer = await createFundedKeypair(2_000_000_000);
    const buyerTokenAccount = await anchor.utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: buyer.publicKey,
    });
    const tradeReceipt = findTradeReceiptPda(listing, new anchor.BN(0));

    await program.methods
      .buyShares(new anchor.BN(12))
      .accounts({
        buyer: buyer.publicKey,
        listing,
        tradeReceipt,
        fractionConfig,
        saleVault,
        vaultAuthority,
        buyerTokenAccount,
        issuer: issuer.publicKey,
        platformTreasury,
        mint: mint.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const listingAfter = await program.account.listingState.fetch(listing);
    expect(listingAfter.remainingSupply.toString()).to.equal("0");
    expect(listingAfter.isActive).to.equal(false);
  });

  it("rejects invalid listing window and invalid buy quantity", async () => {
    const assetId = `a-list-inv-${Date.now()}`;
    const { assetConfig, fractionConfig, mint, vaultAuthority, saleVault } =
      await setupLockedFraction(assetId, 100, 20, 70, 10);

    const badListing = findListingPda(fractionConfig);
    const platformTreasury = (await createFundedKeypair(1_000_000)).publicKey;
    const now = Math.floor(Date.now() / 1000);

    try {
      await program.methods
        .createListing(assetId, new anchor.BN(1_000_000), new anchor.BN(now + 10), new anchor.BN(now - 10), 100)
        .accounts({
          issuer: issuer.publicKey,
          assetConfig,
          fractionConfig,
          listing: badListing,
          saleVault,
          vaultAuthority,
          mint: mint.publicKey,
          platformTreasury,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("invalid listing window must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("InvalidTimeWindow");
    }

    const assetId2 = `a-list-qty-${Date.now()}`;
    const setup2 = await setupLockedFraction(assetId2, 100, 15, 75, 10);
    const listing2 = findListingPda(setup2.fractionConfig);
    const treasury2 = (await createFundedKeypair(1_000_000)).publicKey;

    await program.methods
      .createListing(assetId2, new anchor.BN(1_000_000), new anchor.BN(now - 5), new anchor.BN(now + 600), 200)
      .accounts({
        issuer: issuer.publicKey,
        assetConfig: setup2.assetConfig,
        fractionConfig: setup2.fractionConfig,
        listing: listing2,
        saleVault: setup2.saleVault,
        vaultAuthority: setup2.vaultAuthority,
        mint: setup2.mint.publicKey,
        platformTreasury: treasury2,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const buyer = await createFundedKeypair(1_000_000_000);
    const buyerTokenAccount = await anchor.utils.token.associatedAddress({
      mint: setup2.mint.publicKey,
      owner: buyer.publicKey,
    });

    try {
      await program.methods
        .buyShares(new anchor.BN(0))
        .accounts({
          buyer: buyer.publicKey,
          listing: listing2,
          tradeReceipt: findTradeReceiptPda(listing2, new anchor.BN(0)),
          fractionConfig: setup2.fractionConfig,
          saleVault: setup2.saleVault,
          vaultAuthority: setup2.vaultAuthority,
          buyerTokenAccount,
          issuer: issuer.publicKey,
          platformTreasury: treasury2,
          mint: setup2.mint.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();
      expect.fail("qty=0 must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("InvalidQty");
    }

    try {
      await program.methods
        .buyShares(new anchor.BN(16))
        .accounts({
          buyer: buyer.publicKey,
          listing: listing2,
          tradeReceipt: findTradeReceiptPda(listing2, new anchor.BN(0)),
          fractionConfig: setup2.fractionConfig,
          saleVault: setup2.saleVault,
          vaultAuthority: setup2.vaultAuthority,
          buyerTokenAccount,
          issuer: issuer.publicKey,
          platformTreasury: treasury2,
          mint: setup2.mint.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();
      expect.fail("qty > remaining_supply must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("InsufficientListingSupply");
    }
  });

  it("blocks buy on inactive listing and enforces pause/close authorization", async () => {
    const assetId = `a-list-pause-${Date.now()}`;
    const { assetConfig, fractionConfig, mint, vaultAuthority, saleVault } =
      await setupLockedFraction(assetId, 80, 20, 40, 20);

    const listing = findListingPda(fractionConfig);
    const platformTreasury = (await createFundedKeypair(1_000_000)).publicKey;
    const now = Math.floor(Date.now() / 1000);

    await program.methods
      .createListing(assetId, new anchor.BN(600_000), new anchor.BN(now - 10), new anchor.BN(now + 600), 100)
      .accounts({
        issuer: issuer.publicKey,
        assetConfig,
        fractionConfig,
        listing,
        saleVault,
        vaultAuthority,
        mint: mint.publicKey,
        platformTreasury,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const attacker = await createFundedKeypair(1_000_000_000);
    try {
      await program.methods
        .pauseListing()
        .accounts({
          issuer: attacker.publicKey,
          listing,
        })
        .signers([attacker])
        .rpc();
      expect.fail("unauthorized pause must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("UnauthorizedIssuer");
    }

    try {
      await program.methods
        .closeListing()
        .accounts({
          issuer: attacker.publicKey,
          listing,
        })
        .signers([attacker])
        .rpc();
      expect.fail("unauthorized close must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("UnauthorizedIssuer");
    }

    await program.methods
      .pauseListing()
      .accounts({
        issuer: issuer.publicKey,
        listing,
      })
      .rpc();

    const buyer = await createFundedKeypair(1_000_000_000);
    const buyerTokenAccount = await anchor.utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: buyer.publicKey,
    });

    try {
      await program.methods
        .buyShares(new anchor.BN(1))
        .accounts({
          buyer: buyer.publicKey,
          listing,
          tradeReceipt: findTradeReceiptPda(listing, new anchor.BN(0)),
          fractionConfig,
          saleVault,
          vaultAuthority,
          buyerTokenAccount,
          issuer: issuer.publicKey,
          platformTreasury,
          mint: mint.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();
      expect.fail("buy on inactive listing must fail");
    } catch (err) {
      expect(getErrorCode(err)).to.equal("ListingInactive");
    }
  });
});
