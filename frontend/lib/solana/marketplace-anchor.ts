'use client'

import bs58 from 'bs58'
import { Buffer } from 'buffer'
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'

import { getPhantomProvider, type PhantomProvider } from '@/lib/phantom'

export const TOKENIZATION_PROGRAM_ID = new PublicKey('4XeEJCxc1TLRaFzyfjYjELPdExY1imRAqiZqjuRqz6Kt')
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
export const LAMPORTS_PER_SOL = 1_000_000_000

const TEXT_ENCODER = new TextEncoder()

const DISCRIMINATORS = {
  initializeAsset: Uint8Array.from([214, 153, 49, 248, 95, 248, 208, 179]),
  mintAssetTokens: Uint8Array.from([113, 241, 228, 222, 70, 124, 141, 4]),
  configureFractionalization: Uint8Array.from([17, 240, 24, 225, 10, 17, 234, 184]),
  depositSaleSupply: Uint8Array.from([158, 25, 247, 11, 171, 163, 227, 131]),
  lockFractionModel: Uint8Array.from([42, 154, 168, 72, 232, 163, 144, 56]),
  createListing: Uint8Array.from([18, 168, 45, 24, 191, 31, 117, 54]),
  buyShares: Uint8Array.from([40, 239, 138, 154, 8, 37, 106, 108]),
} as const

const PDA_SEEDS = {
  asset: TEXT_ENCODER.encode('asset'),
  mintAuthority: TEXT_ENCODER.encode('mint-auth'),
  fraction: TEXT_ENCODER.encode('fraction'),
  vaultAuthority: TEXT_ENCODER.encode('vault-auth'),
  listing: TEXT_ENCODER.encode('listing'),
  trade: TEXT_ENCODER.encode('trade'),
} as const

function encodeU16(value: number) {
  const buffer = new Uint8Array(2)
  new DataView(buffer.buffer).setUint16(0, value, true)
  return buffer
}

function encodeU32(value: number) {
  const buffer = new Uint8Array(4)
  new DataView(buffer.buffer).setUint32(0, value, true)
  return buffer
}

function encodeU64(value: number | bigint) {
  const buffer = new Uint8Array(8)
  new DataView(buffer.buffer).setBigUint64(0, BigInt(value), true)
  return buffer
}

function encodeI64(value: number | bigint) {
  const buffer = new Uint8Array(8)
  new DataView(buffer.buffer).setBigInt64(0, BigInt(value), true)
  return buffer
}

function encodeString(value: string) {
  const encoded = TEXT_ENCODER.encode(value)
  return concatBytes(encodeU32(encoded.length), encoded)
}

function concatBytes(...items: Uint8Array[]) {
  const totalLength = items.reduce((sum, item) => sum + item.length, 0)
  const merged = new Uint8Array(totalLength)
  let offset = 0

  for (const item of items) {
    merged.set(item, offset)
    offset += item.length
  }

  return merged
}

function normalizeInteger(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    throw new Error(`${label} must be a positive integer.`)
  }
  return value
}

function normalizeSolPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Price per token must be greater than 0.')
  }

  const lamports = Math.round(value * LAMPORTS_PER_SOL)
  if (lamports <= 0) {
    throw new Error('Price per token is too small.')
  }
  return lamports
}

function findAssociatedTokenAddress(owner: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [owner.toBytes(), TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0]
}

function readPublicKey(bytes: Uint8Array, offset: number) {
  return {
    value: new PublicKey(bytes.slice(offset, offset + 32)),
    offset: offset + 32,
  }
}

function readU64(bytes: Uint8Array, offset: number) {
  return {
    value: Number(new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getBigUint64(0, true)),
    offset: offset + 8,
  }
}

function readI64(bytes: Uint8Array, offset: number) {
  return {
    value: Number(new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getBigInt64(0, true)),
    offset: offset + 8,
  }
}

function readU16(bytes: Uint8Array, offset: number) {
  return {
    value: new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, true),
    offset: offset + 2,
  }
}

function readBool(bytes: Uint8Array, offset: number) {
  return {
    value: bytes[offset] === 1,
    offset: offset + 1,
  }
}

function makeInstruction(
  data: Uint8Array,
  keys: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>,
) {
  return new TransactionInstruction({
    programId: TOKENIZATION_PROGRAM_ID,
    keys,
    data: Buffer.from(data),
  })
}

async function confirmSignature(
  connection: Connection,
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
) {
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash,
      lastValidBlockHeight,
    },
    'confirmed',
  )

  if (confirmation.value.err) {
    throw new Error(`Solana confirmation failed: ${JSON.stringify(confirmation.value.err)}`)
  }
}

async function signAndSend({
  connection,
  provider,
  transaction,
  additionalSigners = [],
}: {
  connection: Connection
  provider: PhantomProvider
  transaction: Transaction
  additionalSigners?: Keypair[]
}) {
  const latestBlockhash = await connection.getLatestBlockhash('confirmed')
  transaction.recentBlockhash = latestBlockhash.blockhash

  for (const signer of additionalSigners) {
    transaction.partialSign(signer)
  }

  if (provider.signAndSendTransaction) {
    const response = await provider.signAndSendTransaction(transaction)
    const signature =
      typeof response.signature === 'string'
        ? response.signature
        : bs58.encode(response.signature)

    await confirmSignature(connection, signature, latestBlockhash.blockhash, latestBlockhash.lastValidBlockHeight)
    return signature
  }

  if (!provider.signTransaction) {
    throw new Error('This Phantom provider does not support transaction signing.')
  }

  const signed = await provider.signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
  })
  await confirmSignature(connection, signature, latestBlockhash.blockhash, latestBlockhash.lastValidBlockHeight)
  return signature
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function readStringField(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function readNumberField(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export type AnchorTokenizationConfig = {
  mode: 'anchor'
  program_id: string
  asset_id: string
  asset_config: string
  fraction_config: string
  listing: string
  sale_vault: string
  vault_authority: string
  mint: string
  issuer_wallet: string
  platform_treasury: string
  start_ts: number
  end_ts: number
  platform_fee_bps: number
  total_shares: number
  sale_supply: number
  creation_signatures: string[]
}

export type AnchorListingSnapshot = {
  asset: string
  fractionConfig: string
  issuer: string
  mint: string
  saleVault: string
  platformTreasury: string
  pricePerShareLamports: number
  remainingSupply: number
  startTs: number
  endTs: number
  platformFeeBps: number
  tradeCount: number
  isActive: boolean
  bump: number
}

export function extractAnchorTokenizationConfig(listing: { external_metadata?: Record<string, unknown> | null }) {
  const metadata = asRecord(listing.external_metadata)
  const tokenization = asRecord(metadata?.tokenization)

  if (!tokenization || tokenization.mode !== 'anchor') {
    return null
  }

  const requiredFields = [
    'program_id',
    'asset_id',
    'asset_config',
    'fraction_config',
    'listing',
    'sale_vault',
    'vault_authority',
    'mint',
    'issuer_wallet',
    'platform_treasury',
  ] as const

  const stringValues = Object.fromEntries(
    requiredFields.map((field) => [field, readStringField(tokenization, field)]),
  ) as Record<(typeof requiredFields)[number], string | null>

  const startTs = readNumberField(tokenization, 'start_ts')
  const endTs = readNumberField(tokenization, 'end_ts')
  const platformFeeBps = readNumberField(tokenization, 'platform_fee_bps')
  const totalShares = readNumberField(tokenization, 'total_shares')
  const saleSupply = readNumberField(tokenization, 'sale_supply')
  const signatures = Array.isArray(tokenization.creation_signatures)
    ? tokenization.creation_signatures.filter((value): value is string => typeof value === 'string')
    : []

  if (
    requiredFields.some((field) => !stringValues[field]) ||
    startTs === null ||
    endTs === null ||
    platformFeeBps === null ||
    totalShares === null ||
    saleSupply === null
  ) {
    return null
  }

  return {
    mode: 'anchor' as const,
    program_id: stringValues.program_id!,
    asset_id: stringValues.asset_id!,
    asset_config: stringValues.asset_config!,
    fraction_config: stringValues.fraction_config!,
    listing: stringValues.listing!,
    sale_vault: stringValues.sale_vault!,
    vault_authority: stringValues.vault_authority!,
    mint: stringValues.mint!,
    issuer_wallet: stringValues.issuer_wallet!,
    platform_treasury: stringValues.platform_treasury!,
    start_ts: startTs,
    end_ts: endTs,
    platform_fee_bps: platformFeeBps,
    total_shares: totalShares,
    sale_supply: saleSupply,
    creation_signatures: signatures,
  }
}

export function decodeAnchorListingAccount(data: Uint8Array) {
  let offset = 8

  const asset = readPublicKey(data, offset)
  offset = asset.offset
  const fractionConfig = readPublicKey(data, offset)
  offset = fractionConfig.offset
  const issuer = readPublicKey(data, offset)
  offset = issuer.offset
  const mint = readPublicKey(data, offset)
  offset = mint.offset
  const saleVault = readPublicKey(data, offset)
  offset = saleVault.offset
  const platformTreasury = readPublicKey(data, offset)
  offset = platformTreasury.offset
  const pricePerShareLamports = readU64(data, offset)
  offset = pricePerShareLamports.offset
  const remainingSupply = readU64(data, offset)
  offset = remainingSupply.offset
  const startTs = readI64(data, offset)
  offset = startTs.offset
  const endTs = readI64(data, offset)
  offset = endTs.offset
  const platformFeeBps = readU16(data, offset)
  offset = platformFeeBps.offset
  const tradeCount = readU64(data, offset)
  offset = tradeCount.offset
  const isActive = readBool(data, offset)
  offset = isActive.offset

  return {
    asset: asset.value.toBase58(),
    fractionConfig: fractionConfig.value.toBase58(),
    issuer: issuer.value.toBase58(),
    mint: mint.value.toBase58(),
    saleVault: saleVault.value.toBase58(),
    platformTreasury: platformTreasury.value.toBase58(),
    pricePerShareLamports: pricePerShareLamports.value,
    remainingSupply: remainingSupply.value,
    startTs: startTs.value,
    endTs: endTs.value,
    platformFeeBps: platformFeeBps.value,
    tradeCount: tradeCount.value,
    isActive: isActive.value,
    bump: data[offset] ?? 0,
  } satisfies AnchorListingSnapshot
}

export async function fetchAnchorListingSnapshot({
  listingAddress,
  rpcUrl,
}: {
  listingAddress: string
  rpcUrl: string
}) {
  const connection = new Connection(rpcUrl, 'confirmed')
  const accountInfo = await connection.getAccountInfo(new PublicKey(listingAddress), 'confirmed')
  if (!accountInfo) {
    throw new Error('On-chain listing account was not found on Solana devnet.')
  }

  return decodeAnchorListingAccount(new Uint8Array(accountInfo.data))
}

export async function createAnchorMarketplaceListing({
  assetId,
  issuerWalletAddress,
  pricePerTokenSol,
  rpcUrl,
  totalTokens,
  provider = getPhantomProvider(),
}: {
  assetId: string
  issuerWalletAddress: string
  pricePerTokenSol: number
  rpcUrl: string
  totalTokens: number
  provider?: PhantomProvider | null
}) {
  if (!provider) {
    throw new Error('Phantom wallet is not available in this browser.')
  }

  const normalizedTotalTokens = normalizeInteger(totalTokens, 'Total tokens')
  const pricePerShareLamports = normalizeSolPrice(pricePerTokenSol)
  const connection = new Connection(rpcUrl, 'confirmed')
  const issuerPublicKey = new PublicKey(issuerWalletAddress)
  const mintKeypair = Keypair.generate()

  const [assetConfig] = PublicKey.findProgramAddressSync(
    [PDA_SEEDS.asset, issuerPublicKey.toBytes(), TEXT_ENCODER.encode(assetId)],
    TOKENIZATION_PROGRAM_ID,
  )
  const [mintAuthority] = PublicKey.findProgramAddressSync(
    [PDA_SEEDS.mintAuthority, assetConfig.toBytes()],
    TOKENIZATION_PROGRAM_ID,
  )
  const [fractionConfig] = PublicKey.findProgramAddressSync(
    [PDA_SEEDS.fraction, assetConfig.toBytes()],
    TOKENIZATION_PROGRAM_ID,
  )
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [PDA_SEEDS.vaultAuthority, fractionConfig.toBytes()],
    TOKENIZATION_PROGRAM_ID,
  )
  const [listing] = PublicKey.findProgramAddressSync(
    [PDA_SEEDS.listing, fractionConfig.toBytes()],
    TOKENIZATION_PROGRAM_ID,
  )

  const issuerTokenAccount = findAssociatedTokenAddress(issuerPublicKey, mintKeypair.publicKey)
  const saleVault = findAssociatedTokenAddress(vaultAuthority, mintKeypair.publicKey)
  const now = Math.floor(Date.now() / 1000)
  const startTs = now - 60
  const endTs = now + 60 * 60 * 24 * 365
  const platformFeeBps = 0

  const txOne = new Transaction({
    feePayer: issuerPublicKey,
  })
  txOne.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 350_000 }))
  txOne.add(
    makeInstruction(
      concatBytes(
        DISCRIMINATORS.initializeAsset,
        encodeString(assetId),
        encodeU64(normalizedTotalTokens),
        encodeU64(normalizedTotalTokens),
      ),
      [
        { pubkey: issuerPublicKey, isSigner: true, isWritable: true },
        { pubkey: assetConfig, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
    ),
  )
  txOne.add(
    makeInstruction(
      concatBytes(DISCRIMINATORS.mintAssetTokens, encodeString(assetId)),
      [
        { pubkey: issuerPublicKey, isSigner: true, isWritable: true },
        { pubkey: assetConfig, isSigner: false, isWritable: true },
        { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: issuerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: mintAuthority, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
    ),
  )

  const txTwo = new Transaction({
    feePayer: issuerPublicKey,
  })
  txTwo.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 450_000 }))
  txTwo.add(
    makeInstruction(
      concatBytes(
        DISCRIMINATORS.configureFractionalization,
        encodeString(assetId),
        encodeU64(normalizedTotalTokens),
        encodeU64(0),
        encodeU64(0),
      ),
      [
        { pubkey: issuerPublicKey, isSigner: true, isWritable: true },
        { pubkey: assetConfig, isSigner: false, isWritable: false },
        { pubkey: fractionConfig, isSigner: false, isWritable: true },
        { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
    ),
  )
  txTwo.add(
    makeInstruction(
      concatBytes(DISCRIMINATORS.depositSaleSupply, encodeString(assetId)),
      [
        { pubkey: issuerPublicKey, isSigner: true, isWritable: true },
        { pubkey: assetConfig, isSigner: false, isWritable: false },
        { pubkey: fractionConfig, isSigner: false, isWritable: true },
        { pubkey: issuerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: saleVault, isSigner: false, isWritable: true },
        { pubkey: vaultAuthority, isSigner: false, isWritable: false },
        { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
    ),
  )
  txTwo.add(
    makeInstruction(
      concatBytes(DISCRIMINATORS.lockFractionModel, encodeString(assetId)),
      [
        { pubkey: issuerPublicKey, isSigner: true, isWritable: false },
        { pubkey: assetConfig, isSigner: false, isWritable: false },
        { pubkey: fractionConfig, isSigner: false, isWritable: true },
      ],
    ),
  )
  txTwo.add(
    makeInstruction(
      concatBytes(
        DISCRIMINATORS.createListing,
        encodeString(assetId),
        encodeU64(pricePerShareLamports),
        encodeI64(startTs),
        encodeI64(endTs),
        encodeU16(platformFeeBps),
      ),
      [
        { pubkey: issuerPublicKey, isSigner: true, isWritable: true },
        { pubkey: assetConfig, isSigner: false, isWritable: false },
        { pubkey: fractionConfig, isSigner: false, isWritable: false },
        { pubkey: listing, isSigner: false, isWritable: true },
        { pubkey: saleVault, isSigner: false, isWritable: false },
        { pubkey: vaultAuthority, isSigner: false, isWritable: false },
        { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
        { pubkey: issuerPublicKey, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
    ),
  )

  const creationSignatures = [
    await signAndSend({
      connection,
      provider,
      transaction: txOne,
      additionalSigners: [mintKeypair],
    }),
    await signAndSend({
      connection,
      provider,
      transaction: txTwo,
    }),
  ]

  return {
    assetId,
    mintAddress: mintKeypair.publicKey.toBase58(),
    tokenization: {
      mode: 'anchor' as const,
      program_id: TOKENIZATION_PROGRAM_ID.toBase58(),
      asset_id: assetId,
      asset_config: assetConfig.toBase58(),
      fraction_config: fractionConfig.toBase58(),
      listing: listing.toBase58(),
      sale_vault: saleVault.toBase58(),
      vault_authority: vaultAuthority.toBase58(),
      mint: mintKeypair.publicKey.toBase58(),
      issuer_wallet: issuerWalletAddress,
      platform_treasury: issuerWalletAddress,
      start_ts: startTs,
      end_ts: endTs,
      platform_fee_bps: platformFeeBps,
      total_shares: normalizedTotalTokens,
      sale_supply: normalizedTotalTokens,
      creation_signatures: creationSignatures,
    } satisfies AnchorTokenizationConfig,
  }
}

export async function buyAnchorMarketplaceListing({
  buyerWalletAddress,
  listingAddress,
  quantity,
  rpcUrl,
  provider = getPhantomProvider(),
}: {
  buyerWalletAddress: string
  listingAddress: string
  quantity: number
  rpcUrl: string
  provider?: PhantomProvider | null
}) {
  if (!provider) {
    throw new Error('Phantom wallet is not available in this browser.')
  }

  const normalizedQuantity = normalizeInteger(quantity, 'Quantity')
  const connection = new Connection(rpcUrl, 'confirmed')
  const buyerPublicKey = new PublicKey(buyerWalletAddress)
  const listingPublicKey = new PublicKey(listingAddress)
  const accountInfo = await connection.getAccountInfo(listingPublicKey, 'confirmed')
  if (!accountInfo) {
    throw new Error('On-chain listing account was not found on Solana devnet.')
  }

  const snapshot = decodeAnchorListingAccount(new Uint8Array(accountInfo.data))
  if (!snapshot.isActive) {
    throw new Error('This on-chain listing is no longer active.')
  }
  if (snapshot.remainingSupply < normalizedQuantity) {
    throw new Error('Not enough remaining on-chain supply for this purchase.')
  }

  const fractionConfigPublicKey = new PublicKey(snapshot.fractionConfig)
  const mintPublicKey = new PublicKey(snapshot.mint)
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [PDA_SEEDS.vaultAuthority, fractionConfigPublicKey.toBytes()],
    TOKENIZATION_PROGRAM_ID,
  )
  const [tradeReceipt] = PublicKey.findProgramAddressSync(
    [PDA_SEEDS.trade, listingPublicKey.toBytes(), encodeU64(snapshot.tradeCount)],
    TOKENIZATION_PROGRAM_ID,
  )
  const buyerTokenAccount = findAssociatedTokenAddress(buyerPublicKey, mintPublicKey)

  const transaction = new Transaction({
    feePayer: buyerPublicKey,
  })
  transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }))
  transaction.add(
    makeInstruction(
      concatBytes(DISCRIMINATORS.buyShares, encodeU64(normalizedQuantity)),
      [
        { pubkey: buyerPublicKey, isSigner: true, isWritable: true },
        { pubkey: listingPublicKey, isSigner: false, isWritable: true },
        { pubkey: tradeReceipt, isSigner: false, isWritable: true },
        { pubkey: fractionConfigPublicKey, isSigner: false, isWritable: false },
        { pubkey: new PublicKey(snapshot.saleVault), isSigner: false, isWritable: true },
        { pubkey: vaultAuthority, isSigner: false, isWritable: false },
        { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: new PublicKey(snapshot.issuer), isSigner: false, isWritable: true },
        { pubkey: new PublicKey(snapshot.platformTreasury), isSigner: false, isWritable: true },
        { pubkey: mintPublicKey, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
    ),
  )

  const signature = await signAndSend({
    connection,
    provider,
    transaction,
  })

  return {
    signature,
    snapshot,
  }
}
