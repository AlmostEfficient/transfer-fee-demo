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
  createAccount,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  getMintLen,
  getTransferFeeAmount,
  harvestWithheldTokensToMint,
  mintTo,
  transferCheckedWithFee,
  unpackAccount,
  withdrawWithheldTokensFromAccounts,
  withdrawWithheldTokensFromMint,
} from '@solana/spl-token';

// We establish a connection to the cluster
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// Next, we create and fund the payer account
const payer = Keypair.generate();
const airdropSignature = await connection.requestAirdrop(
  payer.publicKey,
  LAMPORTS_PER_SOL
);

await connection.confirmTransaction({
  signature: airdropSignature,
  ...(await connection.getLatestBlockhash()),
});

// authority that can mint new tokens
const mintAuthority = Keypair.generate();
const mintKeypair = Keypair.generate();
const mint = mintKeypair.publicKey;
// authority that can modify the transfer fee;/
const transferFeeConfigAuthority = Keypair.generate();
// authority that can move tokens withheld on the mint or token accounts
const withdrawWithheldAuthority = Keypair.generate();
const decimals = 9;
// fee to collect on transfers
// equivalent to 0.5%
const feeBasisPoints = 50;
// maximum fee to collect on transfers
const maxFee = BigInt(5_000);
const mintLen = getMintLen([ExtensionType.TransferFeeConfig]);
const mintLamports = await connection.getMinimumBalanceForRentExemption(
  mintLen
);

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

// The mint is now initialized and ready to use

// TRANSFER WITH FEES STARTS HERE
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
const mintAmount = BigInt(1_000_000_000);
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

const accountKeypair = Keypair.generate();
const destinationAccount = await createAccount(
  connection, // connection to use
  payer, // payer of transaction and intialization fee
  mint, // mint for the account
  owner.publicKey, // owner of the new account
  accountKeypair, // optional keypair
  undefined, // options for confirming transaction
  TOKEN_2022_PROGRAM_ID // SPL token program id
);

// amount of tokens we want to transfer
const transferAmount = BigInt(1_000_000);

// the reason why we divide by 10_000 is that 1 basis point is 1/100th of 1% | 0.01%
const fee = (transferAmount * BigInt(feeBasisPoints)) / BigInt(10_000);

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

await withdrawWithheldTokensFromAccounts(
  connection, // connection to use
  payer, // payer of the transaction fee
  mint, // the token mint
  destinationAccount, // the destination account
  withdrawWithheldAuthority, // the withdraw withheld token authority
  [], // signing accounts
  accountsToWithdrawFrom, // source accounts from which to withdraw withheld fees
  undefined, // options for confirming the transaction
  TOKEN_2022_PROGRAM_ID // SPL token program id
);

await harvestWithheldTokensToMint(
  connection, // connection to use
  payer, // payer of the transaction fee
  mint, // the token mint
  [destinationAccount], // source accounts from which to withdraw withheld fees
  undefined, // options for confirming the transaction
  TOKEN_2022_PROGRAM_ID // SPL token program id
);

await withdrawWithheldTokensFromMint(
  connection, // connection to use
  payer, // payer of the transaction fee
  mint, // the token mint
  destinationAccount, // the destination account
  withdrawWithheldAuthority, // the withdraw withheld authority
  [], // signing accounts
  undefined, // options for confirming the transaction
  TOKEN_2022_PROGRAM_ID // SPL token program id
);
