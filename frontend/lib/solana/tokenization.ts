"use client";

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import type { AssetListing, TokenizedAsset } from "@/lib/api-client";
import { getInjectedSolanaProvider } from "@/lib/solana/provider";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID ?? "4XeEJCxc1TLRaFzyfjYjELPdExY1imRAqiZqjuRqz6Kt",
);
const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "http://localhost:8899";

const DISCRIMINATORS = {
  initialize_asset: hexToBytes("d69931f85ff8d0b3"),
  mint_asset_tokens: hexToBytes("71f1e4de467c8d04"),
  revoke_mint_authority: hexToBytes("8c343deed19dbd20"),
  configure_fractionalization: hexToBytes("11f018e10a11eab8"),
  deposit_sale_supply: hexToBytes("9e19f70baba3e383"),
  lock_fraction_model: hexToBytes("2a9aa848e8a39038"),
  create_listing: hexToBytes("12a82d18bf1f7536"),
  buy_shares: hexToBytes("28ef8a9a08256a6c"),
  pause_listing: hexToBytes("4bca270254c2767c"),
  close_listing: hexToBytes("210fc0514eaf9f61"),
} as const;

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/.{1,2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? []);
}

function getConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, "confirmed");
}

function requireWallet() {
  const provider = getInjectedSolanaProvider();
  if (!provider || !provider.publicKey) {
    throw new Error("Connect a Phantom wallet first");
  }
  return provider;
}

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function encodeU16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function encodeU64(value: number): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true);
  return bytes;
}

function encodeI64(value: number): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigInt64(0, BigInt(value), true);
  return bytes;
}

function encodeString(value: string): Uint8Array {
  const content = textBytes(value);
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, content.length, true);
  return concatBytes(length, content);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }
  return combined;
}

function stringSeed(value: string): Uint8Array {
  return textBytes(value);
}

function u64Seed(value: number): Uint8Array {
  return encodeU64(value);
}

function findAssetConfigPda(issuer: PublicKey, assetId: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [stringSeed("asset"), issuer.toBuffer(), stringSeed(assetId)],
    PROGRAM_ID,
  )[0];
}

function findMintAuthorityPda(assetConfig: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [stringSeed("mint-auth"), assetConfig.toBuffer()],
    PROGRAM_ID,
  )[0];
}

function findFractionConfigPda(assetConfig: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [stringSeed("fraction"), assetConfig.toBuffer()],
    PROGRAM_ID,
  )[0];
}

function findVaultAuthorityPda(fractionConfig: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [stringSeed("vault-auth"), fractionConfig.toBuffer()],
    PROGRAM_ID,
  )[0];
}

function findListingPda(fractionConfig: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [stringSeed("listing"), fractionConfig.toBuffer()],
    PROGRAM_ID,
  )[0];
}

function findTradeReceiptPda(listing: PublicKey, tradeIndex: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [stringSeed("trade"), listing.toBuffer(), u64Seed(tradeIndex)],
    PROGRAM_ID,
  )[0];
}

function findAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

async function sendTransaction(
  transaction: Transaction,
  signers: Keypair[] = [],
): Promise<string> {
  const provider = requireWallet();
  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  transaction.feePayer = provider.publicKey;
  transaction.recentBlockhash = blockhash;
  if (signers.length > 0) {
    transaction.partialSign(...signers);
  }

  const signedTransaction = await provider.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTransaction.serialize());
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}

export async function executeInitializeAsset(params: {
  assetId: string;
  totalShares: number;
  saleSupply: number;
}) {
  const provider = requireWallet();
  const issuer = provider.publicKey!;
  const assetConfig = findAssetConfigPda(issuer, params.assetId);

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: issuer, isSigner: true, isWritable: true },
      { pubkey: assetConfig, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: concatBytes(
      DISCRIMINATORS.initialize_asset,
      encodeString(params.assetId),
      encodeU64(params.totalShares),
      encodeU64(params.saleSupply),
    ),
  });

  const transaction = new Transaction().add(instruction);
  const signature = await sendTransaction(transaction);
  return { signature, assetConfigAddress: assetConfig.toBase58() };
}

export async function executeMintAssetTokens(tokenization: TokenizedAsset) {
  const provider = requireWallet();
  const issuer = provider.publicKey!;
  const assetConfig = new PublicKey(tokenization.asset_config_address ?? findAssetConfigPda(issuer, tokenization.asset_id));
  const mint = Keypair.generate();
  const issuerTokenAccount = findAssociatedTokenAddress(issuer, mint.publicKey);
  const mintAuthority = findMintAuthorityPda(assetConfig);

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: issuer, isSigner: true, isWritable: true },
      { pubkey: assetConfig, isSigner: false, isWritable: true },
      { pubkey: mint.publicKey, isSigner: true, isWritable: true },
      { pubkey: issuerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: mintAuthority, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: concatBytes(
      DISCRIMINATORS.mint_asset_tokens,
      encodeString(tokenization.asset_id),
    ),
  });

  const transaction = new Transaction().add(instruction);
  const signature = await sendTransaction(transaction, [mint]);
  return {
    signature,
    assetConfigAddress: assetConfig.toBase58(),
    mintAddress: mint.publicKey.toBase58(),
  };
}

export async function executeRevokeMintAuthority(tokenization: TokenizedAsset) {
  const provider = requireWallet();
  const issuer = provider.publicKey!;
  if (!tokenization.asset_config_address || !tokenization.mint_address) {
    throw new Error("Mint revoke requires asset config and mint addresses");
  }

  const assetConfig = new PublicKey(tokenization.asset_config_address);
  const mint = new PublicKey(tokenization.mint_address);
  const mintAuthority = findMintAuthorityPda(assetConfig);

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: issuer, isSigner: true, isWritable: false },
      { pubkey: assetConfig, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: mintAuthority, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: concatBytes(
      DISCRIMINATORS.revoke_mint_authority,
      encodeString(tokenization.asset_id),
    ),
  });

  const transaction = new Transaction().add(instruction);
  const signature = await sendTransaction(transaction);
  return { signature, assetConfigAddress: assetConfig.toBase58(), mintAddress: mint.toBase58() };
}

export async function executeConfigureFractionalization(tokenization: TokenizedAsset) {
  const provider = requireWallet();
  const issuer = provider.publicKey!;
  if (!tokenization.asset_config_address || !tokenization.mint_address) {
    throw new Error("Fraction configuration requires asset config and mint addresses");
  }

  const assetConfig = new PublicKey(tokenization.asset_config_address);
  const fractionConfig = findFractionConfigPda(assetConfig);
  const mint = new PublicKey(tokenization.mint_address);

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: issuer, isSigner: true, isWritable: true },
      { pubkey: assetConfig, isSigner: false, isWritable: false },
      { pubkey: fractionConfig, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: concatBytes(
      DISCRIMINATORS.configure_fractionalization,
      encodeString(tokenization.asset_id),
      encodeU64(tokenization.sale_supply),
      encodeU64(tokenization.issuer_reserve),
      encodeU64(tokenization.platform_reserve),
    ),
  });

  const transaction = new Transaction().add(instruction);
  const signature = await sendTransaction(transaction);
  return { signature, fractionConfigAddress: fractionConfig.toBase58() };
}

export async function executeDepositSaleSupply(tokenization: TokenizedAsset) {
  const provider = requireWallet();
  const issuer = provider.publicKey!;
  if (!tokenization.asset_config_address || !tokenization.fraction_config_address || !tokenization.mint_address) {
    throw new Error("Deposit requires asset config, fraction config, and mint addresses");
  }

  const assetConfig = new PublicKey(tokenization.asset_config_address);
  const fractionConfig = new PublicKey(tokenization.fraction_config_address);
  const mint = new PublicKey(tokenization.mint_address);
  const vaultAuthority = findVaultAuthorityPda(fractionConfig);
  const issuerTokenAccount = findAssociatedTokenAddress(issuer, mint);
  const saleVault = findAssociatedTokenAddress(vaultAuthority, mint);

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: issuer, isSigner: true, isWritable: true },
      { pubkey: assetConfig, isSigner: false, isWritable: false },
      { pubkey: fractionConfig, isSigner: false, isWritable: true },
      { pubkey: issuerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: saleVault, isSigner: false, isWritable: true },
      { pubkey: vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: concatBytes(
      DISCRIMINATORS.deposit_sale_supply,
      encodeString(tokenization.asset_id),
    ),
  });

  const transaction = new Transaction().add(instruction);
  const signature = await sendTransaction(transaction);
  return { signature, saleVaultAddress: saleVault.toBase58() };
}

export async function executeLockFractionModel(tokenization: TokenizedAsset) {
  const provider = requireWallet();
  const issuer = provider.publicKey!;
  if (!tokenization.asset_config_address || !tokenization.fraction_config_address) {
    throw new Error("Lock requires asset config and fraction config addresses");
  }

  const assetConfig = new PublicKey(tokenization.asset_config_address);
  const fractionConfig = new PublicKey(tokenization.fraction_config_address);

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: issuer, isSigner: true, isWritable: false },
      { pubkey: assetConfig, isSigner: false, isWritable: false },
      { pubkey: fractionConfig, isSigner: false, isWritable: true },
    ],
    data: concatBytes(
      DISCRIMINATORS.lock_fraction_model,
      encodeString(tokenization.asset_id),
    ),
  });

  const transaction = new Transaction().add(instruction);
  const signature = await sendTransaction(transaction);
  return { signature };
}

export async function executeCreateListing(tokenization: TokenizedAsset, listing: AssetListing) {
  const provider = requireWallet();
  const issuer = provider.publicKey!;
  if (!tokenization.asset_config_address || !tokenization.fraction_config_address || !tokenization.mint_address) {
    throw new Error("Listing creation requires asset config, fraction config, and mint addresses");
  }

  const assetConfig = new PublicKey(tokenization.asset_config_address);
  const fractionConfig = new PublicKey(tokenization.fraction_config_address);
  const mint = new PublicKey(tokenization.mint_address);
  const listingAddress = findListingPda(fractionConfig);
  const vaultAuthority = findVaultAuthorityPda(fractionConfig);
  const saleVault = findAssociatedTokenAddress(vaultAuthority, mint);
  const treasury = new PublicKey(listing.platform_treasury_address);
  const startTimestamp = Math.floor(new Date(listing.start_ts).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(listing.end_ts).getTime() / 1000);

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: issuer, isSigner: true, isWritable: true },
      { pubkey: assetConfig, isSigner: false, isWritable: false },
      { pubkey: fractionConfig, isSigner: false, isWritable: false },
      { pubkey: listingAddress, isSigner: false, isWritable: true },
      { pubkey: saleVault, isSigner: false, isWritable: false },
      { pubkey: vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: concatBytes(
      DISCRIMINATORS.create_listing,
      encodeString(tokenization.asset_id),
      encodeU64(listing.price_per_share_lamports),
      encodeI64(startTimestamp),
      encodeI64(endTimestamp),
      encodeU16(listing.platform_fee_bps),
    ),
  });

  const transaction = new Transaction().add(instruction);
  const signature = await sendTransaction(transaction);
  return {
    signature,
    listingAddress: listingAddress.toBase58(),
    saleVaultAddress: saleVault.toBase58(),
  };
}

export async function executePauseListing(listing: AssetListing, tokenization: TokenizedAsset) {
  const provider = requireWallet();
  const issuer = provider.publicKey!;
  const listingAddress = new PublicKey(
    listing.listing_address ?? findListingPda(new PublicKey(tokenization.fraction_config_address!)),
  );

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: issuer, isSigner: true, isWritable: false },
      { pubkey: listingAddress, isSigner: false, isWritable: true },
    ],
    data: DISCRIMINATORS.pause_listing,
  });

  const transaction = new Transaction().add(instruction);
  const signature = await sendTransaction(transaction);
  return { signature, listingAddress: listingAddress.toBase58() };
}

export async function executeCloseListing(listing: AssetListing, tokenization: TokenizedAsset) {
  const provider = requireWallet();
  const issuer = provider.publicKey!;
  const listingAddress = new PublicKey(
    listing.listing_address ?? findListingPda(new PublicKey(tokenization.fraction_config_address!)),
  );

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: issuer, isSigner: true, isWritable: false },
      { pubkey: listingAddress, isSigner: false, isWritable: true },
    ],
    data: DISCRIMINATORS.close_listing,
  });

  const transaction = new Transaction().add(instruction);
  const signature = await sendTransaction(transaction);
  return { signature, listingAddress: listingAddress.toBase58() };
}

export async function executeBuyShares(params: {
  listing: AssetListing;
  tokenization: TokenizedAsset;
  quantity: number;
}) {
  const provider = requireWallet();
  const buyer = provider.publicKey!;
  if (
    !params.listing.listing_address ||
    !params.tokenization.fraction_config_address ||
    !params.tokenization.mint_address ||
    !params.listing.sale_vault_address
  ) {
    throw new Error("Listing mirror is missing on-chain addresses required for purchase");
  }

  const listing = new PublicKey(params.listing.listing_address);
  const fractionConfig = new PublicKey(params.tokenization.fraction_config_address);
  const tradeReceipt = findTradeReceiptPda(listing, params.listing.trade_count);
  const saleVault = new PublicKey(params.listing.sale_vault_address);
  const vaultAuthority = findVaultAuthorityPda(fractionConfig);
  const mint = new PublicKey(params.tokenization.mint_address);
  const buyerTokenAccount = findAssociatedTokenAddress(buyer, mint);
  const issuer = new PublicKey(params.tokenization.issuer_wallet_address);
  const platformTreasury = new PublicKey(params.listing.platform_treasury_address);

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: listing, isSigner: false, isWritable: true },
      { pubkey: tradeReceipt, isSigner: false, isWritable: true },
      { pubkey: fractionConfig, isSigner: false, isWritable: false },
      { pubkey: saleVault, isSigner: false, isWritable: true },
      { pubkey: vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: issuer, isSigner: false, isWritable: true },
      { pubkey: platformTreasury, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: concatBytes(
      DISCRIMINATORS.buy_shares,
      encodeU64(params.quantity),
    ),
  });

  const transaction = new Transaction().add(instruction);
  const signature = await sendTransaction(transaction);
  return {
    signature,
    tradeReceiptAddress: tradeReceipt.toBase58(),
    tradeIndex: params.listing.trade_count,
  };
}
