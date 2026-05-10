# Wallet Compromise Checker

A simple public Web3 security app for instantly scanning wallet addresses on Ethereum, Base, Arbitrum, and Solana.

## Features

- Wallet risk scan
- Security score
- Dangerous approval detection
- Scam contract alerts
- Multi-chain support

## Run locally

1. Install dependencies:

```bash
cd wallet-compromise-checker
npm install
```

2. Start the app:

```bash
npm run dev
```

5. Open `http://localhost:3000` in your browser.

## GitHub Pages deployment

This app is now static-export compatible.

1. Add a GitHub Actions workflow to build and export the site.
2. Publish the generated `wallet-compromise-checker/out` folder to GitHub Pages.
