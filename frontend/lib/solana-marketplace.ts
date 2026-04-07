'use client'

import bs58 from 'bs58'
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'

import { getPhantomProvider, type PhantomProvider } from '@/lib/phantom'

export async function sendMarketplaceSolanaTransfer({
  amountLamports,
  walletAddress,
  treasuryWalletAddress,
  rpcUrl,
  provider = getPhantomProvider(),
}: {
  amountLamports: number
  walletAddress: string
  treasuryWalletAddress: string
  rpcUrl: string
  provider?: PhantomProvider | null
}) {
  if (!provider) {
    throw new Error('Phantom wallet is not available in this browser.')
  }
  if (!provider.signAndSendTransaction) {
    throw new Error('This Phantom provider does not support transaction signing.')
  }

  const connection = new Connection(rpcUrl, 'confirmed')
  const fromPubkey = new PublicKey(walletAddress)
  const toPubkey = new PublicKey(treasuryWalletAddress)
  const latestBlockhash = await connection.getLatestBlockhash('confirmed')

  const transaction = new Transaction({
    feePayer: fromPubkey,
    recentBlockhash: latestBlockhash.blockhash,
  }).add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports: amountLamports,
    }),
  )

  const response = await provider.signAndSendTransaction(transaction)
  const signature =
    typeof response.signature === 'string'
      ? response.signature
      : bs58.encode(response.signature)

  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    'confirmed',
  )
  if (confirmation.value.err) {
    throw new Error(`Solana confirmation failed: ${JSON.stringify(confirmation.value.err)}`)
  }

  return signature
}
