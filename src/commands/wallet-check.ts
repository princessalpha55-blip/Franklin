import chalk from 'chalk';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { createPublicClient, http, type Address } from 'viem';
import { mainnet, base } from 'viem/chains';

const EVM_RPCS = {
  ethereum: 'https://rpc.ankr.com/eth',
  base: 'https://rpc.ankr.com/base',
};

function formatEthBalance(balance: bigint) {
  return `${(Number(balance) / 1e18).toFixed(6)} ${chalk.dim('ETH')}`;
}

function formatSolBalance(lamports: number) {
  return `${(lamports / 1e9).toFixed(6)} ${chalk.dim('SOL')}`;
}

function detectChain(address: string): 'ethereum' | 'base' | 'solana' | null {
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) return 'ethereum';
  try {
    new PublicKey(address);
    return 'solana';
  } catch {
    return null;
  }
}

async function checkEvmWallet(address: string, chainOverride: 'ethereum' | 'base') {
  const chainName = chainOverride || (detectChain(address) === 'base' ? 'base' : 'ethereum');
  const client = createPublicClient({
    chain: chainName === 'base' ? base : mainnet,
    transport: http(EVM_RPCS[chainName]),
  });

  const balance = await client.getBalance({ address: address as Address });
  const nonce = await client.getTransactionCount({ address: address as Address });
  const code = await client.getCode({ address: address as Address });

  const findings: string[] = [];

  findings.push(`Chain: ${chalk.magenta(chainName)}`);
  findings.push(`Address: ${chalk.cyan(address)}`);
  findings.push(`Nonce: ${chalk.yellow(String(nonce))}`);
  findings.push(`Balance: ${chalk.green(formatEthBalance(balance))}`);

  if (code !== '0x') {
    findings.push(chalk.red('Notice: this address is a smart contract, not an EOA wallet.'));
  }

  if (nonce === 0) {
    findings.push(chalk.yellow('No transaction history found. This address has not been active on-chain yet.'));
  } else {
    findings.push(chalk.yellow(`Transaction history exists (nonce ${nonce}).`));
    if (balance === 0n) {
      findings.push(chalk.red('This wallet has activity but no native balance; it may have been drained.'));
    } else if (balance < 1_000_000_000_000_000_000n) {
      findings.push(chalk.yellow('This wallet has some activity and a low native balance; monitor for suspicious outgoing transfers.'));
    }
  }

  return findings;
}

async function checkSolanaWallet(address: string) {
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const pubkey = new PublicKey(address);

  const balance = await connection.getBalance(pubkey);
  const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 20 });
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
    programId: TOKEN_PROGRAM_ID,
  });

  const findings: string[] = [];

  findings.push(`Chain: ${chalk.magenta('solana')}`);
  findings.push(`Address: ${chalk.cyan(address)}`);
  findings.push(`Balance: ${chalk.green(formatSolBalance(balance))}`);
  findings.push(`Recent transaction lookback: ${chalk.yellow(String(signatures.length))} entries`);

  if (signatures.length === 0) {
    findings.push(chalk.yellow('No recent activity found.'));
  }

  const delegateAccounts = tokenAccounts.value.filter((item) => {
    const info = item.account.data.parsed.info;
    return info.delegate && info.delegate !== null;
  });

  if (delegateAccounts.length > 0) {
    findings.push(
      chalk.red(
        `Detected ${delegateAccounts.length} token account(s) with a delegate. Delegated spend authority can be used by third-party programs.`
      )
    );
  }

  if (signatures.length > 0) {
    const parsed = await connection.getParsedTransactions(signatures.map((sig) => sig.signature), {
      commitment: 'confirmed',
    });

    const drainEvents = parsed.reduce((count, tx) => {
      if (!tx || !tx.meta) return count;
      const pre = tx.meta.preBalances.reduce((acc, value) => acc + value, 0);
      const post = tx.meta.postBalances.reduce((acc, value) => acc + value, 0);
      return count + (post < pre ? 1 : 0);
    }, 0);

    if (drainEvents > 0) {
      findings.push(
        chalk.yellow(
          `Among the last ${signatures.length} txs, ${drainEvents} transaction(s) reduced the wallet's combined SOL balance.`
        )
      );
    }

    if (balance === 0) {
      findings.push(chalk.red('Current SOL balance is zero after recent activity; this wallet may have been drained.'));
    } else if (balance < 0.01 * 1e9) {
      findings.push(chalk.yellow('Current SOL balance is very low; monitor for suspicious draining behavior.'));
    }
  }

  if (tokenAccounts.value.length > 0) {
    findings.push(
      chalk.yellow(
        `Token accounts: ${tokenAccounts.value.length}. Review token balances and any delegated authorities for unexpected permissions.`
      )
    );
  }

  return findings;
}

export async function walletCheckCommand(address: string, options: { chain?: string }) {
  const explicitChain = options.chain ? (options.chain.toLowerCase() as 'ethereum' | 'base' | 'solana') : undefined;
  const detected = detectChain(address);

  if (!detected && !explicitChain) {
    console.error(chalk.red('Unable to detect chain from the address. Use --chain solana|ethereum|base.'));
    process.exit(1);
  }

  if (explicitChain && explicitChain !== 'solana' && explicitChain !== 'ethereum' && explicitChain !== 'base') {
    console.error(chalk.red('Invalid chain. Use solana, ethereum, or base.'));
    process.exit(1);
  }

  const chain = explicitChain ?? detected;

  try {
    const report =
      chain === 'solana'
        ? await checkSolanaWallet(address)
        : await checkEvmWallet(address, chain === 'base' ? 'base' : 'ethereum');

    console.log(chalk.bold('Wallet Compromise Checker Report'));
    console.log(chalk.dim('----------------------------------'));
    for (const line of report) {
      console.log(line);
    }

    console.log();
    console.log(
      chalk.dim(
        'This scanner provides a first-pass risk check only. Use forensic tools for a deeper compromise investigation.'
      )
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(chalk.red(`Error scanning wallet: ${message}`));
    process.exit(1);
  }
}
