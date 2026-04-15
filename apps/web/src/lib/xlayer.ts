import type { Chain } from '@rainbow-me/rainbowkit';

export const xlayer = {
  id: 196,
  name: 'X Layer',
  iconBackground: '#09090b',
  nativeCurrency: {
    name: 'OKB',
    symbol: 'OKB',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.xlayer.tech', 'https://xlayerrpc.okx.com'],
    },
    public: {
      http: ['https://rpc.xlayer.tech', 'https://xlayerrpc.okx.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'OKX Explorer',
      url: 'https://www.okx.com/web3/explorer/xlayer',
    },
  },
} as const satisfies Chain;
