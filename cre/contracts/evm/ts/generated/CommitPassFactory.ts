// Code generated — DO NOT EDIT.
import {
  decodeEventLog,
  decodeFunctionResult,
  encodeEventTopics,
  encodeFunctionData,
  zeroAddress,
} from "viem";
import type { Address, Hex } from "viem";
import {
  bytesToHex,
  encodeCallMsg,
  EVMClient,
  hexToBase64,
  LAST_FINALIZED_BLOCK_NUMBER,
  prepareReportRequest,
  type EVMLog,
  type Runtime,
} from "@chainlink/cre-sdk";

export interface DecodedLog<T> extends Omit<EVMLog, "data"> {
  data: T;
}

const encodeTopicValue = (t: Hex | Hex[] | null | undefined): string[] => {
  if (t == null) return [];
  if (Array.isArray(t)) return t.map(hexToBase64);
  return [hexToBase64(t)];
};

/**
 * Filter params for LifecycleRequested. Only indexed fields can be used for filtering.
 * Indexed string/bytes must be passed as keccak256 hash (Hex).
 */
export type LifecycleRequestedTopics = {
  vault?: `0x${string}`;
};

/**
 * Decoded LifecycleRequested event data.
 */
export type LifecycleRequestedDecoded = {
  vault: `0x${string}`;
  action: number;
};

export const CommitPassFactoryABI = [
  {
    type: "function",
    name: "getBatch",
    inputs: [{ name: "slot", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "result", type: "address[]", internalType: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isVault",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "LifecycleRequested",
    inputs: [
      {
        name: "vault",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      { name: "action", type: "uint8", indexed: false, internalType: "uint8" },
    ],
    anonymous: false,
  },
] as const;

export class CommitPassFactory {
  constructor(
    private readonly client: EVMClient,
    public readonly address: Address,
  ) {}

  getBatch(runtime: Runtime<unknown>, slot: bigint): readonly `0x${string}`[] {
    const callData = encodeFunctionData({
      abi: CommitPassFactoryABI,
      functionName: "getBatch" as const,
      args: [slot],
    });

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({
          from: zeroAddress,
          to: this.address,
          data: callData,
        }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result();

    return decodeFunctionResult({
      abi: CommitPassFactoryABI,
      functionName: "getBatch" as const,
      data: bytesToHex(result.data),
    }) as readonly `0x${string}`[];
  }

  isVault(runtime: Runtime<unknown>, arg0: `0x${string}`): boolean {
    const callData = encodeFunctionData({
      abi: CommitPassFactoryABI,
      functionName: "isVault" as const,
      args: [arg0],
    });

    const result = this.client
      .callContract(runtime, {
        call: encodeCallMsg({
          from: zeroAddress,
          to: this.address,
          data: callData,
        }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result();

    return decodeFunctionResult({
      abi: CommitPassFactoryABI,
      functionName: "isVault" as const,
      data: bytesToHex(result.data),
    }) as boolean;
  }

  writeReport(
    runtime: Runtime<unknown>,
    callData: Hex,
    gasConfig?: { gasLimit?: string },
  ) {
    const reportResponse = runtime
      .report(prepareReportRequest(callData))
      .result();

    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report: reportResponse,
        gasConfig,
      })
      .result();
  }

  /**
   * Creates a log trigger for LifecycleRequested events.
   * The returned trigger's adapt method decodes the raw log into LifecycleRequestedDecoded,
   * so the handler receives typed event data directly.
   * When multiple filters are provided, topic values are merged with OR semantics (match any).
   */
  logTriggerLifecycleRequested(filters?: LifecycleRequestedTopics[]) {
    let topics: { values: string[] }[];
    if (!filters || filters.length === 0) {
      const encoded = encodeEventTopics({
        abi: CommitPassFactoryABI,
        eventName: "LifecycleRequested" as const,
      });
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }));
    } else if (filters.length === 1) {
      const f = filters[0]!;
      const args = {
        vault: f.vault,
      };
      const encoded = encodeEventTopics({
        abi: CommitPassFactoryABI,
        eventName: "LifecycleRequested" as const,
        args,
      });
      topics = encoded.map((t) => ({ values: encodeTopicValue(t) }));
    } else {
      const allEncoded = filters.map((f) => {
        const args = {
          vault: f.vault,
        };
        return encodeEventTopics({
          abi: CommitPassFactoryABI,
          eventName: "LifecycleRequested" as const,
          args,
        });
      });
      topics = allEncoded[0]!.map((_, i) => ({
        values: [
          ...new Set(allEncoded.flatMap((row) => encodeTopicValue(row[i]))),
        ],
      }));
    }
    const baseTrigger = this.client.logTrigger({
      addresses: [hexToBase64(this.address)],
      topics,
    });
    const contract = this;
    return {
      capabilityId: () => baseTrigger.capabilityId(),
      method: () => baseTrigger.method(),
      outputSchema: () => baseTrigger.outputSchema(),
      configAsAny: () => baseTrigger.configAsAny(),
      adapt: (rawOutput: EVMLog): DecodedLog<LifecycleRequestedDecoded> =>
        contract.decodeLifecycleRequested(rawOutput),
    };
  }

  /**
   * Decodes a log into LifecycleRequested data, preserving all log metadata.
   */
  decodeLifecycleRequested(log: EVMLog): DecodedLog<LifecycleRequestedDecoded> {
    const decoded = decodeEventLog({
      abi: CommitPassFactoryABI,
      data: bytesToHex(log.data),
      topics: log.topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]],
    });
    const { data: _, ...rest } = log;
    return {
      ...rest,
      data: decoded.args as unknown as LifecycleRequestedDecoded,
    };
  }
}
