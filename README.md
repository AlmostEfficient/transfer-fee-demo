# transfer-fee-demo
Create a token that has a transfer fee on every transfer using Javascript! Uses the transfer fee extension on the Token-22 program. **Look at all the headings in this readme, they will answer your questions.**

## Setup requirements - Node.js, pnpm, git
- Latest version of [Node.js](https://nodejs.org/en/download/) installed. 
- `pnpm` for installing dependencies, get it [here](https://pnpm.js.org/en/installation).
- Clone or download this repository and navigate to the directory in your terminal. 
- Run `pnpm install` to install dependencies.

## Usage
Run scripts using `node <script-name>`.

- `create-token.js`: Creates a new token with the transfer fee extension. You can configure `decimals`, `feeBasisPoints` (fee percentage), and `maxFee` (maximum fee to collect on transfers).
- `mint-and-transfer.js`: Mints 10 tokens and transfers them to a generated account. You can configure which account to send the tokens to.
- `withdraw-tokens.js`: Withdraws tax from holders' token accounts to the recipient address saved in the mint and transfer script. You can configure which account to send the tokens to.

Run each script in order, starting with `create-token.js`. 

## I don't understand _______ 
You're gonna be fine! We'll be doing this on the devnet, which is a test network that doesn't use real money. You don't need to understand how *everything* works, just try to figure out what you're doing at a high level. (i.e. wtf is a keypair?)

If you don't know a term or a specific step, just google it. I highly recommend [ChatGPT](https://chat.openai.com/) for learning about new concepts. 

## Mainnet changes
When running this for real, you'll want to swap out a bunch of `keypair.generate()` calls with keypairs you control. Here's what you might want to replace:

- `payer`: the account that pays for all transactions
- `mintAuthority`: the account that can mint new tokens
- `mintKeypair`: the mint account (tokens come from here)
- `transferFeeConfigAuthority`: the account that can modify the transfer fee
- `withdrawWithheldAuthority`: the account that can move tokens withheld on the mint or token accounts

### Loading keypairs from a file
The scripts in this repo are set up to run on the devnet. They save all generated keypairs to a `.env` file when run. Replace them with your own keypairs and load them like this:
```
import { Keypair } from '@solana/web3.js';
import dotenv from 'dotenv';
dotenv.config();

// Replace PAYER with the name/label of keypair you want to load
const payer = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(process.env.PAYER))
);

if (!payer) { throw new Error('PAYER not found') }
console.log('Payer address:', payer.publicKey.toBase58());
``` 

Note: dotenv not required on Node 20.6+.

### Loading keypairs from the environment or JSON file
If you want to load keypairs from the system environment or a JSON file (like `~/.config/solana/id.json`), check out the [node-helpers](https://www.npmjs.com/package/@solana-developers/node-helpers) package.

## Pseudo-code for each step
There's a lot going on and it can be overwhelming. I've written out some pseudo-code for each section to help you understand what's going on.

Notes - single payer used for all scripts.

### `create-token.js`
1. **Setup**  
imports  
connect to devnet  
generate payer keypair (this account will pay for all txns)  
airdrop SOL to payer  

2. **create necessary keypairs**  
generate mint authority - can mint new tokens  
generate mint keypair - the mint account (tokens come from here)  
generate transfer fee config authority - can modify the transfer fee  
generate withdraw withheld tokens authority - can move tokens withheld on mint or token accounts  

3. **Configure token & mint account**  
set token decimals  
set token feeBasisPoints (fee percentage)  
set maximum fee to collect on transfers  
get mint length - how much space to allocate to the mint account  
get mintLamports - how many lamports we need for the amount of space taken up (used for rent)  

4. **Create token mint**   
Create instructions for a new account with createAccountInstruction  
Initialize the transfer fee extension  
Initialize the new account as a token mint  
Create tx with these 3 instructions, send  

### `mint-and-transfer.js`
1. **Setup**  
imports  
connect to devnet  
load keypairs from .env file  
Check balance of payer  

2. **Create necessary accounts**  
Generate "owner" keypair  
Create new token account for "owner"  
Mint tokens to the new token account (owner)  
Generate "recipient" keypair  
Create new token account for recipient  

3. **Transferring tokens**  
Calculate transfer fee  
Transfer tokens from owner to recipient using transferCheckedWithFee  

### `withdraw-tokens.js`
1. **Setup**  
imports  
connect to devnet  
load keypairs from .env file  

2. **Find and withdraw withheld tokens from token accounts**  
Iterate over all token accounts for the mint and find which accounts have tokens withheld  
getProgramAccounts to find all Token22 accounts for the mint  
Loop over all accounts, use getTransferFeeAmount to see if there are any tokens withheld  
Withdraw tokens from relevant accounts using withdrawWithheldTokens  

3. **Withdraw withheld tokens from mint account**  
Lets you remove tokens from the mint account and send them to any account so you burn/spend/trade them. **Uncomment if you want to use it**.

**Withheld tokens in mint account vs token accounts:**  
All transfer fees are withheld in users' token accounts and only the authority can withdraw them. Optionally, users can purge their token accounts of withheld tokens by withdrawing them to the mint account. This is why you can withdraw from both mint account AND token accounts. 

## Troubleshooting
`bigint: Failed to load bindings, pure JS will be used (try npm run rebuild?)`

Can be safely ignored. If you want to get rid of it, run `pnpm install bigint-buffer`.

`Error: failed to send transaction: Transaction simulation failed: Error processing Instruction 0: custom program error: 0x1`
Something is wrong with your transaction setup. Check what you changed and make sure you're using the right keypairs. The error message should give you a hint.

429 - Too many requests
You can only request airdrops twice a day per IP address. You'll have to source some devnet SOL from another faucet, like the [Lamport DAO](https://discord.com/invite/deHy9bqsrP) faucet.