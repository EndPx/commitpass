import { createPublicClient, http, type Address } from "viem";
import { activeChain, activeDeployment, isLocal } from "./runtime-network";

export const chainClient = createPublicClient({
  chain: activeChain,
  batch: { multicall: isLocal ? false : { wait: 20, batchSize: 4096 } },
  transport: http(undefined, { timeout: 15000, retryCount: 1 }),
});
export const factoryAddress = activeDeployment.contracts.CommitPassFactory
  .address as Address;
export const assetAddress = activeDeployment.contracts.USDC.address as Address;
export const explorer = activeChain.blockExplorers.default.url;
