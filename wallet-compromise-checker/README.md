# Wallet Compromise Checker

A simple public Web3 security app for instantly scanning wallet addresses on Ethereum, Base, Arbitrum, and Solana.

## Features

- Wallet risk scan
- Security score
- Dangerous approval detection
- Scam contract alerts
- Multi-chain support

## Run locally

1. Copy `.env.example` to `.env`.
2. Add your `ALCHEMY_API_KEY` and `MORALIS_API_KEY`.
3. Install dependencies:

```bash
cd wallet-compromise-checker
npm install
```

4. Start the app:

```bash
npm run dev
```

5. Open `http://localhost:3000` in your browser.

## Deploy to Cloudflare Pages

1. Create a Cloudflare Pages project and set the root directory to `wallet-compromise-checker`.
2. Add the following GitHub secrets to your repo:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_PROJECT_NAME`
3. Push to `main` and GitHub Actions will deploy automatically.
