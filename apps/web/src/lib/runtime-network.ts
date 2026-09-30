import { monadTestnetChain, monadTestnetDeployment } from "@commitpass/shared";
import type { Address } from "viem";

type LocalDeployment = {
  runId: string;
  chainId: number;
  contracts: Record<"CommitPassFactory" | "USDC", { address: Address }>;
};
const raw = process.env.NEXT_PUBLIC_COMMITPASS_LOCAL_DEPLOYMENT;
const local: LocalDeployment | null = raw ? JSON.parse(raw) : null;
if (
  local &&
  (local.chainId !== 10143 ||
    !/^[a-z0-9]{12,32}$/.test(local.runId) ||
    ["CommitPassFactory", "USDC"].some(
      (name) =>
        !/^0x[0-9a-fA-F]{40}$/.test(
          local.contracts[name as keyof LocalDeployment["contracts"]]
            ?.address ?? "",
        ),
    ))
) {
  throw new Error("Invalid local deployment configuration");
}
export const isLocal = !!local;
export const localRunId = local?.runId ?? "";
export const runtimeStorageKey = (key: string) =>
  local ? `local:${local.runId}:${key}` : key;
export const activeDeployment = local ?? monadTestnetDeployment;
export const activeChain = local
  ? {
      ...monadTestnetChain,
      name: "CommitPass Local (Anvil)",
      nativeCurrency: { name: "Local MON", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: ["http://127.0.0.1:8547"] } },
      blockExplorers: {
        default: { name: "Local receipt", url: "http://localhost:3000/local" },
      },
    }
  : monadTestnetChain;
