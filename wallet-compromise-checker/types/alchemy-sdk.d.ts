declare module '@alch/alchemy-sdk' {
  export class Alchemy {
    constructor(settings: { apiKey: string; network: any });
    core: {
      getBalance(address: string): Promise<any>;
      getTransactionCount(address: string): Promise<number>;
      getCode(address: string): Promise<string>;
      getTokenBalances(address: string): Promise<{ tokenBalances: Array<any> }>;
    };
  }

  export const Network: {
    ETH_MAINNET: string;
    BASE_MAINNET: string;
    ARB_MAINNET: string;
  };
}
