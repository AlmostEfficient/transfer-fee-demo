import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  getTransferFeeAmount,
  unpackAccount,
  withdrawWithheldTokensFromAccounts,
} from '@solana/spl-token';
import dotenv from 'dotenv';
dotenv.config();

const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

const payer = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(process.env.PAYER))
);

const mint = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(process.env.MINT_KEYPAIR))
).publicKey;

const withdrawWithheldAuthority = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(process.env.WITHDRAW_WITHHELD_AUTHORITY))
);

const recipientKeypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(process.env.RECIPIENT_KEYPAIR))
);

const allAccounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
  commitment: 'confirmed',
  filters: [
    {
      memcmp: {
        offset: 0,
        bytes: mint.toString(),
      },
    },
  ],
});

const accountsToWithdrawFrom = [];

for (const accountInfo of allAccounts) {
  const account = unpackAccount(
    accountInfo.pubkey,
    accountInfo.account,
    TOKEN_2022_PROGRAM_ID
  );

  // We then extract the transfer fee extension data from the account
  const transferFeeAmount = getTransferFeeAmount(account);

  if (
    transferFeeAmount !== null &&
    transferFeeAmount.withheldAmount > BigInt(0)
  ) {
    accountsToWithdrawFrom.push(accountInfo.pubkey);
  }
}

console.log(
  'Found',
  accountsToWithdrawFrom.length,
  'accounts to withdraw from 🤑'
);

const withdrawTokensSig = await withdrawWithheldTokensFromAccounts(
  connection, // connection to use
  payer, // payer of the transaction fee
  mint, // the token mint
  recipientKeypair.publicKey, // the destination account
  withdrawWithheldAuthority, // the withdraw withheld token authority
  [], // signing accounts
  accountsToWithdrawFrom, // source accounts from which to withdraw withheld fees
  undefined, // options for confirming the transaction
  TOKEN_2022_PROGRAM_ID // SPL token program id
);

console.log(
  'Bag secured, check it:',
  `https://solana.fm/tx/${withdrawTokensSig}?cluster=devnet-solana`
);
