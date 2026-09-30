import { MONAD_TESTNET } from "./automation.js";

/** Minimal EVM chain metadata; avoids importing every viem chain into the web SDK. */
export const monadTestnetChain = {
  id: MONAD_TESTNET.chainId,
  name: "Monad Testnet",
  nativeCurrency: { name: "Testnet MON Token", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: {
    default: { name: "Monadscan", url: "https://testnet.monadscan.com" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 251449,
    },
  },
  testnet: true,
} as const;
