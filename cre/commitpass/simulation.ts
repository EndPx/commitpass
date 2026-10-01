import { type Runtime } from "@chainlink/cre-sdk";
import { secp256k1 } from "@noble/curves/secp256k1";
import {
  encodeAbiParameters,
  hashTypedData,
  type Address,
  type Hex,
} from "viem";
import { MONAD_TESTNET } from "@commitpass/shared";
import type { Config } from "./config";

// Only CLI broadcast targets configure this signer; DON reports use workflow metadata.
export function signSimulationPayload(
  runtime: Runtime<Config>,
  vault: Address,
  payload: Hex,
): Hex {
  if (!runtime.config.simulationSigningSecretId) return payload;
  const key = runtime
    .getSecret({ id: runtime.config.simulationSigningSecretId })
    .result().value;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key))
    throw new Error("Simulation signing key unavailable");
  const digest = hashTypedData({
    domain: {
      name: "CommitPass CRE simulation",
      version: "1",
      chainId: MONAD_TESTNET.chainId,
      verifyingContract: vault,
    },
    types: { SimulationReport: [{ name: "payload", type: "bytes" }] },
    primaryType: "SimulationReport",
    message: { payload },
  });
  try {
    const signature = secp256k1.sign(digest.slice(2), key.slice(2), {
      lowS: true,
    });
    if (signature.recovery > 1) throw new Error("Unsupported recovery ID");
    const encoded =
      `0x${signature.toCompactHex()}${(signature.recovery + 27).toString(16)}` as Hex;
    return encodeAbiParameters(
      [{ type: "bytes" }, { type: "bytes" }],
      [payload, encoded],
    );
  } catch {
    throw new Error("Could not sign simulation report");
  }
}
