import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  createAccount,
  mintTo,
  transferCheckedWithFee,
} from '@solana/spl-token';
import { addKeypairToEnvFile } from '@solana-developers/node-helpers';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.PAYER || !process.env.MINT_AUTHORITY || !process.env.MINT_KEYPAIR) {
  throw new Error('Necessary keypairs not found, have you run the create-token script?');
}

const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

const payer = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(process.env.PAYER))
);

const mintAuthority = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(process.env.MINT_AUTHORITY))
);

const mint = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(process.env.MINT_KEYPAIR))
).publicKey;

const balance = await connection.getBalance(payer.publicKey);
if (balance < 10000000) { // 0.01 SOL
  throw new Error(
    'Not enough SOL in payer account, please fund: ',
    payer.publicKey.toBase58()
  );
}

const feeBasisPoints = 50;
const decimals = 9;

const owner = Keypair.generate();

const sourceAccount = await createAccount(
  connection, // connection to use
  payer, // payer of transaction and intialization fee
  mint, // mint for the account
  owner.publicKey, // owner of the new account
  undefined, // optional keypair
  undefined, // options for confirming transaction
  TOKEN_2022_PROGRAM_ID // SPL token program id
);

// amount of tokens to mint to the new account
const mintAmount = BigInt(1_000_000_000_000);
await mintTo(
  connection, // connection to use
  payer, // payer of transaction fee
  mint, // mint for the token account
  sourceAccount, // address of account to mint to
  mintAuthority, // minting authority
  mintAmount, // amount to mint
  [], // signing acocunt
  undefined, // options for confirming the transaction
  TOKEN_2022_PROGRAM_ID // SPL token program id
);

const recipientKeypair = Keypair.generate();
await addKeypairToEnvFile(recipientKeypair, 'RECIPIENT_KEYPAIR');

const destinationAccount = await createAccount(
  connection, // connection to use
  payer, // payer of transaction and intialization fee
  mint, // mint for the account
  owner.publicKey, // owner of the new account
  recipientKeypair, // optional keypair
  undefined, // options for confirming transaction
  TOKEN_2022_PROGRAM_ID // SPL token program id
);

// amount of tokens we want to transfer
const transferAmount = BigInt(10_000_000_000);

// the reason why we divide by 10_000 is that 1 basis point is 1/100th of 1% | 0.01%
let fee = (transferAmount * BigInt(feeBasisPoints)) / BigInt(10_000);
if (fee > BigInt(5_000)) {
  fee = BigInt(5_000); // Max fee
}

const transferCheckedWithFeeSig = await transferCheckedWithFee(
  connection, // connection to use
  payer, // payer of the transaction fee
  sourceAccount, // source account
  mint, // mint for the account
  destinationAccount, // destination account
  owner, // owner of the source account
  transferAmount, // number of tokens to transfer
  decimals, // number of decimals
  fee, // expected fee collected for transfer
  [], // signing accounts
  undefined, // options for confirming the transaction
  TOKEN_2022_PROGRAM_ID // SPL token program id
);

console.log(
  'Tokens minted and transferred:',
  `https://solana.fm/tx/${transferCheckedWithFeeSig}?cluster=devnet-solana`
);
