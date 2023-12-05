# transfer-fee-demo
Create a token that has a transfer fee on every transfer using Javascript! Uses the transfer fee extension on the Token-22 program.

## Setup - Node.js, pnpm, git
Make sure you have the latest version of [Node.js](https://nodejs.org/en/download/) installed. Clone or download this repository and navigate to the directory in your terminal. I recommend using pnpm to install dependencies, get it [here](https://pnpm.js.org/en/installation). Then run `pnpm install` to install dependencies.

## I don't understand _______ 
You're gonna be fine! We'll be doing this on the devnet, which is a test network that doesn't use real money. You don't need to understand how *everything* works, just try to figure out what you're doing at a high level. (i.e. wtf is a keypair?)

If you don't know a term or a specific step, just google it. I highly recommend [ChatGPT](https://chat.openai.com/) for learning about new concepts. 

## Mainnet changes
When running this for real, you'll want to swap out a bunch of `keypair.generate()` calls with keypairs you control. Here's what you might want to replace in main.js:

- `payer`: the account that pays for all transactions, replace with funded keypair
- `mintAuthority`: the account that can mint new tokens
- `mintKeypair`: the mint account (tokens come from here)
- `transferFeeConfigAuthority`: the account that can modify the transfer fee
- `withdrawWithheldAuthority`: the account that can move tokens withheld on the mint or token accounts

## Pseudo-code for each step
There's a lot going on and it can be overwhelming. I've written out some pseudo-code for each section to help you understand what's going on.

Notes - single payer for entire script.

1. Setup 
imports
connect to devnet
generate payer keypair (this account will pay for all txns)
airdrop SOL to payer

2. create necessary keypairs
generate mint authority - can mint new tokens
generate mint keypair - the mint account (tokens come from here)
generate transfer fee config authority - can modify the transfer fee
generate withdraw withheld tokens authority - can move tokens withheld on mint or token accounts

3. Configure token & mint account
set token decimals
set token feeBasisPoints (fee percentage)
set maximum fee to collect on transfers
get mint length - how much space to allocate to the mint account
get mintLamports - how much lamports we need for this amount of space

4. Create token mint 
Create instructions for a new account with createAccountInstruction
Initialize the transfer fee extension
Initialize the new account as a token mint
Create tx with these 3 instructions, send

5. Transferring tokens
Generate "owner" keypair
Create new token account for "owner"
Mint tokens to the new token account (owner)
Generate "recipient" keypair
Create new token account for recipient
Calculate transfer fee
Transfer tokens from owner to recipient using transferCheckedWithFee

6. Find and withdraw withheld tokens from accounts
Iterate over all token accounts for the mint and find which accounts have tokens withheld
getProgramAccounts to find all Token22 accounts for the mint
Loop over all accounts, use getTransferFeeAmount to see if there are any tokens withheld
Withdraw tokens from relevant accounts using withdrawWithheldTokens

7. Harvest withheld tokens to mint
Necessary to close an account, transfers the withheld tokens from user account to mint account

8. Withdraw withheld tokens
Lets you remove tokens from the mint account and send them to any account so you burn/spend/trade them. 
