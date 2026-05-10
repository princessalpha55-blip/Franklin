import { Alchemy, Network } from '@alch/alchemy-sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { NextResponse } from 'next/server';

const NETWORK_MAP: Record<string, string> = {
  ethereum: Network.ETH_MAINNET,
  base: Network.BASE_MAINNET,
  arbitrum: Network.ARB_MAINNET,
};

const MORALIS_CHAIN_MAP: Record<string, string> = {
  ethereum: 'eth',
  base: 'base',
  arbitrum: 'arb',
};

const alchemyKey = process.env.ALCHEMY_API_KEY;
const moralisKey = process.env.MORALIS_API_KEY;

function normalizeScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

async function fetchMoralisApprovals(address: string, chain: string) {
  if (!moralisKey) return [];

  const mapped = MORALIS_CHAIN_MAP[chain] ?? chain;
  const res = await fetch(
    `https://deep-index.moralis.io/api/v2/${address}/erc20/approvals?chain=${mapped}`,
    {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': moralisKey,
      },
    }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.result) ? data.result : [];
}

export async function POST(req: Request) {
  const body = await req.json();
  const address = String(body.address || '').trim();
  const chain = String(body.chain || 'ethereum').toLowerCase();

  if (!address) {
    return NextResponse.json({ error: 'Missing wallet address' }, { status: 400 });
  }

  if (chain === 'solana') {
    try {
      const pubkey = new PublicKey(address);
      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

      const balance = await connection.getBalance(pubkey);
      const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 20 });
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
        programId: TOKEN_PROGRAM_ID,
      });

      const delegateAccounts = tokenAccounts.value.filter((item) => {
        const info = item.account.data.parsed.info;
        return info.delegate && info.delegate !== null;
      });

      const findings = [
        `Chain: Solana`,
        `Balance: ${(balance / 1e9).toFixed(6)} SOL`,
        `Recent transactions: ${signatures.length}`,
        `Token accounts: ${tokenAccounts.value.length}`,
      ];

      if (signatures.length === 0) {
        findings.push('No recent activity detected. The address may be dormant or newly created.');
      }

      if (delegateAccounts.length > 0) {
        findings.push(
          `Detected ${delegateAccounts.length} token account(s) with delegated authorities. Review approvals carefully.`
        );
      }

      if (balance === 0) {
        findings.push('Zero SOL balance after recent activity. This address may have been drained.');
      }

      let score = 100;
      if (signatures.length === 0) score -= 10;
      if (delegateAccounts.length > 0) score -= 25;
      if (balance === 0) score -= 25;
      if (tokenAccounts.value.length > 5) score -= 5;
      score = normalizeScore(score);

      return NextResponse.json({ score, findings });
    } catch (error) {
      return NextResponse.json({ error: 'Invalid Solana address or RPC issue.' }, { status: 400 });
    }
  }

  if (!alchemyKey) {
    return NextResponse.json({ error: 'ALCHEMY_API_KEY is required in the app environment.' }, { status: 500 });
  }

  const network = NETWORK_MAP[chain];
  if (!network) {
    return NextResponse.json({ error: 'Unsupported chain. Use ethereum, base, or arbitrum.' }, { status: 400 });
  }

  try {
    const alchemy = new Alchemy({ apiKey: alchemyKey, network });
    const balance = await alchemy.core.getBalance(address);
    const nonce = await alchemy.core.getTransactionCount(address);
    const code = await alchemy.core.getCode(address);
    const tokenBalances = await alchemy.core.getTokenBalances(address);
    const approvalList = await fetchMoralisApprovals(address, chain);

    const findings = [
      `Chain: ${chain.charAt(0).toUpperCase() + chain.slice(1)}`,
      `Balance: ${Number(balance.toString()) / 1e18} ETH-equivalent`,
      `Transactions: ${nonce}`,
      `Contract: ${code !== '0x' ? 'Yes' : 'No'}`,
      `Token balances: ${tokenBalances.tokenBalances.length}`,
    ];

    if (code !== '0x') {
      findings.push('This address is a smart contract. Audit the contract source before trusting any interactions.');
    }

    if (nonce === 0) {
      findings.push('No on-chain transaction history. Newly-created wallets can still be risky if they have approvals.');
    }

    if (balance.isZero()) {
      findings.push('Zero native balance. The wallet may have been drained or is only holding tokens.');
    }

    if (approvalList.length > 0) {
      findings.push(`Detected ${approvalList.length} token approval(s). Review allowances for third-party spending.`);
    }

    const scoreModifiers = [
      code !== '0x' ? -15 : 0,
      nonce === 0 ? -10 : 0,
      balance.isZero() ? -20 : 0,
      approvalList.length > 0 ? -Math.min(40, approvalList.length * 10) : 0,
      tokenBalances.tokenBalances.length > 10 ? -5 : 0,
    ];

    const score = normalizeScore(100 + scoreModifiers.reduce((acc, value) => acc + value, 0));

    return NextResponse.json({ score, findings });
  } catch (error) {
    return NextResponse.json({ error: 'Unable to scan address. Confirm the address and the API configuration.' }, { status: 500 });
  }
}
