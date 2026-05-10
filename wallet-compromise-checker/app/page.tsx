'use client';

import { FormEvent, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { createPublicClient, http, type Address } from 'viem';
import { mainnet, base, arbitrum } from 'viem/chains';

const chainOptions = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'base', label: 'Base' },
  { value: 'arbitrum', label: 'Arbitrum' },
  { value: 'solana', label: 'Solana' },
];

const RPC_URLS: Record<string, string> = {
  ethereum: 'https://rpc.ankr.com/eth',
  base: 'https://rpc.ankr.com/base',
  arbitrum: 'https://rpc.ankr.com/arbitrum',
};

function getScoreClass(score: number) {
  if (score >= 70) return 'bg-success text-black';
  if (score >= 40) return 'bg-warning text-black';
  return 'bg-danger text-black';
}

function isEthereumAddress(address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function buildEvmClient(chain: string) {
  const rpc = RPC_URLS[chain] || RPC_URLS.ethereum;
  const network = chain === 'base' ? base : chain === 'arbitrum' ? arbitrum : mainnet;
  return createPublicClient({
    chain: network,
    transport: http(rpc),
  });
}

async function scanEvm(address: string, chain: string) {
  const client = buildEvmClient(chain);
  const findings: string[] = [];
  const normalized = address.toLowerCase();

  findings.push(`Chain: ${chain.charAt(0).toUpperCase() + chain.slice(1)}`);
  findings.push(`Address: ${normalized}`);

  const balance = await client.getBalance({ address: normalized as Address });
  const nonce = await client.getTransactionCount({ address: normalized as Address });
  const code = await client.getCode({ address: normalized as Address });

  findings.push(`Balance: ${Number(balance) / 1e18} ETH-equivalent`);
  findings.push(`Transaction count: ${nonce}`);
  findings.push(`Contract account: ${code !== '0x' ? 'Yes' : 'No'}`);

  let score = 100;
  if (nonce === 0) {
    findings.push('No on-chain history detected. This wallet is new or dormant.');
    score -= 10;
  }
  if (balance === 0n) {
    findings.push('Zero native balance. The wallet may be uncompromised or drained.');
    score -= 20;
  }
  if (code !== '0x') {
    findings.push('Address is a smart contract. Review the contract before trusting it.');
    score -= 10;
  }
  if (balance < 1_000_000_000_000_000_000n && balance > 0n) {
    findings.push('Low native balance. Monitor for suspicious outgoing transfers.');
    score -= 5;
  }

  score = Math.max(0, Math.min(100, score));
  return { score, findings };
}

async function scanSolana(address: string) {
  const findings: string[] = [];
  const pubkey = new PublicKey(address);
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  findings.push('Chain: Solana');
  findings.push(`Address: ${pubkey.toBase58()}`);

  const balance = await connection.getBalance(pubkey);
  const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 20 });
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
    programId: TOKEN_PROGRAM_ID,
  });

  findings.push(`Balance: ${(balance / 1e9).toFixed(6)} SOL`);
  findings.push(`Recent transactions: ${signatures.length}`);
  findings.push(`Token accounts: ${tokenAccounts.value.length}`);

  let score = 100;
  if (signatures.length === 0) {
    findings.push('No recent activity detected. The wallet is dormant or newly created.');
    score -= 10;
  }
  if (balance === 0) {
    findings.push('Zero SOL balance. The wallet may have been drained or empty.');
    score -= 20;
  }

  const delegateAccounts = tokenAccounts.value.filter((item) => {
    const info = item.account.data.parsed.info;
    return info.delegate && info.delegate !== null;
  });

  if (delegateAccounts.length > 0) {
    findings.push(`Detected ${delegateAccounts.length} delegated token account(s). Review token approvals.`);
    score -= 20;
  }

  score = Math.max(0, Math.min(100, score));
  return { score, findings };
}

export default function Home() {
  const [address, setAddress] = useState('');
  const [chain, setChain] = useState('ethereum');
  const [isLoading, setIsLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [report, setReport] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleScan(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setReport([]);
    setScore(null);

    const trimmed = address.trim();
    if (!trimmed) {
      setError('Enter a valid wallet address.');
      return;
    }

    if (chain !== 'solana' && !isEthereumAddress(trimmed)) {
      setError('Enter a valid EVM wallet address (0x...) for the selected chain.');
      return;
    }

    setIsLoading(true);

    try {
      const result = chain === 'solana' ? await scanSolana(trimmed) : await scanEvm(trimmed, chain);
      setScore(result.score);
      setReport(result.findings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected scan error');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-10 shadow-[0_20px_120px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="mb-8 space-y-4">
            <p className="text-sm uppercase tracking-[0.3em] text-white/60">Wallet Compromise Checker</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Instant Web3 wallet risk scanning.
            </h1>
            <p className="mx-auto max-w-2xl text-base text-white/70 sm:text-lg">
              Paste any address to get an instant security report for Ethereum, Base, Arbitrum, or Solana.
            </p>
          </div>

          <form className="grid gap-4 sm:grid-cols-[1fr_180px]" onSubmit={handleScan}>
            <div className="rounded-2xl border border-white/10 bg-black/70 px-4 py-4 text-left shadow-inner shadow-white/5">
              <label className="mb-2 block text-sm font-medium text-white/60" htmlFor="wallet-address">
                Wallet address
              </label>
              <input
                id="wallet-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-white/40"
                placeholder="0x... or Solana address"
              />
              <div className="mt-4 flex items-center gap-3">
                <label className="text-sm text-white/60" htmlFor="chain">Chain</label>
                <select
                  id="chain"
                  value={chain}
                  onChange={(event) => setChain(event.target.value)}
                  className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-white outline-none"
                >
                  {chainOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="rounded-2xl bg-white px-6 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Scanning…' : 'Scan Wallet'}
            </button>
          </form>

          {error ? (
            <div className="mt-6 rounded-2xl border border-danger/40 bg-danger/10 px-5 py-4 text-left text-sm text-danger">
              {error}
            </div>
          ) : null}

          {score !== null ? (
            <div className="mt-8 grid gap-4 md:grid-cols-[240px_1fr]">
              <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 text-left">
                <p className="text-sm uppercase tracking-[0.3em] text-white/50">Security score</p>
                <p className={`mt-4 inline-flex rounded-full px-4 py-2 text-sm font-semibold ${getScoreClass(score)}`}>{score}/100</p>
                <p className="mt-4 text-sm text-white/70">A simple risk index based on activity, contract status, and balance signals.</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 text-left">
                <p className="text-sm uppercase tracking-[0.3em] text-white/50">Security report</p>
                <div className="mt-4 space-y-3 text-sm text-white/75">
                  {report.length > 0 ? (
                    report.map((line, index) => (
                      <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        {line}
                      </div>
                    ))
                  ) : (
                    <p>No findings available.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          {[
            'Wallet risk scan',
            'Security score',
            'Low-cost browser-only scanning',
            'Pure GitHub Pages deployment',
          ].map((feature) => (
            <div key={feature} className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left text-sm text-white/70">
              <p className="font-semibold text-white">{feature}</p>
            </div>
          ))}
        </section>
      </section>
    </main>
  );
}
