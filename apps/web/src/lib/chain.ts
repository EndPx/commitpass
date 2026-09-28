import { createPublicClient, http, type Address } from "viem";
import { monadTestnetChain, monadTestnetDeployment } from "@commitpass/shared";

export const chainClient = createPublicClient({
  chain: monadTestnetChain,
  transport: http(undefined, { timeout: 15000, retryCount: 1 }),
});
export const factoryAddress = monadTestnetDeployment.contracts.CommitPassFactory
  .address as Address;
export const automationAddress = monadTestnetDeployment.contracts
  .CommitPassAutomation.address as Address;
export const assetAddress = monadTestnetDeployment.contracts.MockAUSD
  .address as Address;
export const explorer = monadTestnetChain.blockExplorers.default.url;
