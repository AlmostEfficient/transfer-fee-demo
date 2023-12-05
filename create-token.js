import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  getMintLen,
} from '@solana/spl-token';
import { addKeypairToEnvFile } from '@solana-developers/node-helpers';

// We establish a connection to the cluster
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// Next, we create and fund the payer account
const payer = Keypair.generate();
console.log('Payer address:', payer.publicKey.toBase58());
await addKeypairToEnvFile(payer, 'PAYER');

const airdropSignature = await connection.requestAirdrop(
  payer.publicKey,
  LAMPORTS_PER_SOL
);

await connection.confirmTransaction({
  signature: airdropSignature,
  ...(await connection.getLatestBlockhash()),
});

console.log(
  'Payer Account Balance:',
  await connection.getBalance(payer.publicKey)
);

// authority that can mint new tokens
const mintAuthority = Keypair.generate();
console.log('Mint Authority address:', mintAuthority.publicKey.toBase58());
await addKeypairToEnvFile(mintAuthority, 'MINT_AUTHORITY');

// mint account, tokens come from here
const mintKeypair = Keypair.generate();
console.log('Mint address:', mintKeypair.publicKey.toBase58());
await addKeypairToEnvFile(mintKeypair, 'MINT_KEYPAIR');
const mint = mintKeypair.publicKey;

// authority that can modify the transfer fee
const transferFeeConfigAuthority = Keypair.generate();
await addKeypairToEnvFile(
  transferFeeConfigAuthority,
  'TRANSFER_FEE_CONFIG_AUTHORITY'
);
console.log(
  'Transfer Fee Config Authority address:',
  transferFeeConfigAuthority.publicKey.toBase58()
);

// authority that can move tokens withheld on the mint or token accounts
const withdrawWithheldAuthority = Keypair.generate();
await addKeypairToEnvFile(
  withdrawWithheldAuthority,
  'WITHDRAW_WITHHELD_AUTHORITY'
);
console.log(
  'Withdraw Withheld Authority address:',
  withdrawWithheldAuthority.publicKey.toBase58()
);

const decimals = 9;
// fee to collect on transfers in basis points, equivalent to 0.5%
// Don't use ur brain, use https://www.omnicalculator.com/finance/basis-point
const feeBasisPoints = 50;
// maximum fee to collect on transfers
const maxFee = BigInt(5_000);
const mintLen = getMintLen([ExtensionType.TransferFeeConfig]);
const mintLamports =
  await connection.getMinimumBalanceForRentExemption(mintLen);

const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: payer.publicKey, // account that will transfer lamports to created account
  newAccountPubkey: mint, // public key of the created account
  space: mintLen, // amount of bytes to allocate to the created account
  lamports: mintLamports, // amount of lamports to transfer to created account
  programId: TOKEN_2022_PROGRAM_ID, // public key of the program to assign as owner of created account
});

const initializeTransferFeeConfig =
  createInitializeTransferFeeConfigInstruction(
    mint, // token mint account
    transferFeeConfigAuthority.publicKey, // authority that can update fees
    withdrawWithheldAuthority.publicKey, // authority that can withdraw fees
    feeBasisPoints, // amount of transfer collected as fees
    maxFee, // maximum fee to collect on transfers
    TOKEN_2022_PROGRAM_ID // SPL token program id
  );

const initializeMintInstruction = createInitializeMintInstruction(
  mint, // token mint
  decimals, // number of decimals
  mintAuthority.publicKey, // minting authority
  null, // optional authority that can freeze token accounts
  TOKEN_2022_PROGRAM_ID // SPL token program id
);

const mintTransaction = new Transaction().add(
  createAccountInstruction,
  initializeTransferFeeConfig,
  initializeMintInstruction
);

const mintTransactionSig = await sendAndConfirmTransaction(
  connection,
  mintTransaction,
  [payer, mintKeypair],
  undefined
);

console.log(
  'Token created!',
  `https://solana.fm/tx/${mintTransactionSig}?cluster=devnet-solana`
);
