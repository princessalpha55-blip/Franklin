import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wallet Compromise Checker',
  description: 'Instant Web3 wallet risk scanning for Ethereum, Base, Arbitrum, and Solana.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
