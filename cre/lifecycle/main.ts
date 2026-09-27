import {
  CronCapability,
  EVMClient,
  HTTPClient,
  Runner,
  TxStatus,
  consensusIdenticalAggregation,
  encodeCallMsg,
  EVM_DEFAULT_REPORT_ENCODER,
  getNetwork,
  handler,
  hexToBase64,
  LAST_FINALIZED_BLOCK_NUMBER,
  type EVMLog,
  type HTTPSendRequester,
  type Runtime,
} from "@chainlink/cre-sdk";
import { EVM_PB } from "@chainlink/cre-sdk/pb";
import {
  bytesToHex,
  decodeEventLog,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  keccak256,
  toEventSelector,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
} from "viem";
import { z } from "zod";
import {
  automationAbi,
  MONAD_TESTNET,
  reportParameters,
  snapshotParameters,
  type AttendanceSnapshot,
} from "@commitpass/shared";

const address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .transform((value) => getAddress(value));
const uint = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/)
  .refine((value) => BigInt(value) < 2n ** 256n);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const configSchema = z
  .object({
    receiver: address.refine(
      (value) => value !== zeroAddress,
      "Deploy the receiver and configure its address",
    ),
    attendanceApi: z
      .string()
      .url()
      .refine((value) => new URL(value).protocol === "https:"),
    attendanceSecretId: z.string().min(1),
    gasLimit: z.string().regex(/^[1-9][0-9]*$/),
  })
  .strict();
type Config = z.infer<typeof configSchema>;

const snapshotSchema = z
  .object({
    version: z.literal(1),
    chainId: uint,
    vault: address,
    eventId: uint,
    cutoff: uint,
    frozen: z.literal(true),
    attendees: z.array(address).min(1).max(500),
    snapshotHash: hash,
  })
  .strict();

function client() {
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: MONAD_TESTNET.selectorName,
    isTestnet: true,
  });
  if (!network)
    throw new Error("Monad testnet is unavailable in this CRE runtime");
  return new EVMClient(network.chainSelector.selector);
}

function read(runtime: Runtime<Config>, evm: EVMClient, data: Hex): Hex {
  const reply = evm
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: runtime.config.receiver,
        data,
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    })
    .result();
  return bytesToHex(reply.data);
}

function fetchSnapshot(
  requester: HTTPSendRequester,
  url: string,
  token: string,
): string {
  const response = requester
    .sendRequest({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    })
    .result();
  if (response.statusCode !== 200)
    throw new Error(
      `Attendance API status ${response.statusCode}; settlement deferred`,
    );
  if (response.body.length > 64_000)
    throw new Error("Attendance response too large");
  const parsed = snapshotSchema.parse(
    JSON.parse(new TextDecoder().decode(response.body)),
  );
  // Each node agrees on the validated snapshot, with stable key order.
  return JSON.stringify(parsed);
}

function settleSnapshot(
  runtime: Runtime<Config>,
  vault: Address,
  eventId: bigint,
  cutoff: bigint,
) {
  const token = runtime
    .getSecret({ id: runtime.config.attendanceSecretId })
    .result().value;
  const url = `${runtime.config.attendanceApi.replace(/\/$/, "")}/v1/attendance-snapshots/${MONAD_TESTNET.chainId}/${vault}/${eventId}/${cutoff}`;
  const encoded = new HTTPClient()
    .sendRequest(
      runtime,
      fetchSnapshot,
      consensusIdenticalAggregation<string>(),
    )(url, token)
    .result();
  const snapshot = JSON.parse(encoded) as AttendanceSnapshot;
  if (
    BigInt(snapshot.chainId) !== BigInt(MONAD_TESTNET.chainId) ||
    snapshot.vault !== vault ||
    BigInt(snapshot.eventId) !== eventId ||
    BigInt(snapshot.cutoff) !== cutoff
  ) {
    throw new Error(
      "Attendance snapshot belongs to a different event or cutoff",
    );
  }
  let previous = 0n;
  for (const attendee of snapshot.attendees) {
    if (BigInt(attendee) <= previous)
      throw new Error("Attendance must be sorted and unique");
    previous = BigInt(attendee);
  }
  const digest = keccak256(
    encodeAbiParameters(snapshotParameters, [
      BigInt(MONAD_TESTNET.chainId),
      vault,
      eventId,
      cutoff,
      snapshot.attendees,
    ]),
  );
  if (digest !== snapshot.snapshotHash.toLowerCase())
    throw new Error("Attendance snapshot hash mismatch");
  return { attendees: snapshot.attendees, hash: digest };
}

function processEvent(
  runtime: Runtime<Config>,
  evm: EVMClient,
  vault: Address,
) {
  const [eventId, action, cutoff] = decodeFunctionResult({
    abi: automationAbi,
    functionName: "getState",
    data: read(
      runtime,
      evm,
      encodeFunctionData({
        abi: automationAbi,
        functionName: "getState",
        args: [vault],
      }),
    ),
  });
  if (action === 0) return "not due";
  if (action !== 1 && action !== 2)
    throw new Error("Unsupported lifecycle action");
  const snapshot =
    action === 2
      ? settleSnapshot(runtime, vault, eventId, cutoff)
      : { attendees: [] as Address[], hash: zeroHash };
  const payload = encodeAbiParameters(reportParameters, [
    BigInt(MONAD_TESTNET.chainId),
    vault,
    action,
    BigInt(Math.floor(runtime.now().getTime() / 1000) + 300),
    action === 2 ? cutoff : 0n,
    snapshot.hash,
    snapshot.attendees,
  ]);
  const report = runtime
    .report({
      encodedPayload: hexToBase64(payload),
      ...EVM_DEFAULT_REPORT_ENCODER,
    })
    .result();
  const result = evm
    .writeReport(runtime, {
      receiver: hexToBase64(runtime.config.receiver),
      report,
      gasConfig: { gasLimit: runtime.config.gasLimit },
    })
    .result();
  if (
    result.txStatus !== TxStatus.SUCCESS ||
    result.receiverContractExecutionStatus !==
      EVM_PB.ReceiverContractExecutionStatus.SUCCESS
  ) {
    throw new Error(
      `Lifecycle write failed for ${vault}: tx=${result.txStatus}, receiver=${result.receiverContractExecutionStatus}`,
    );
  }
  runtime.log(`Lifecycle action ${action} confirmed for ${vault}`);
  return "confirmed";
}

function onCron(runtime: Runtime<Config>) {
  const evm = client();
  const slot = BigInt(Math.floor(runtime.now().getTime() / 60_000));
  const vaults = decodeFunctionResult({
    abi: automationAbi,
    functionName: "getBatch",
    data: read(
      runtime,
      evm,
      encodeFunctionData({
        abi: automationAbi,
        functionName: "getBatch",
        args: [slot],
      }),
    ),
  });
  let failures = 0;
  for (const vault of vaults) {
    try {
      processEvent(runtime, evm, vault);
    } catch {
      failures++;
      // Do not echo capability exceptions that might contain authenticated request details.
      runtime.log(`Deferred lifecycle action for ${vault}`);
    }
  }
  if (failures > 0)
    throw new Error(
      `${failures} lifecycle action(s) deferred; retry on a subsequent sweep`,
    );
  return "sweep completed";
}

function onRequest(runtime: Runtime<Config>, log: EVMLog) {
  if (getAddress(bytesToHex(log.address)) !== runtime.config.receiver)
    throw new Error("Unexpected log source");
  const event = decodeEventLog({
    abi: automationAbi,
    eventName: "LifecycleRequested",
    data: bytesToHex(log.data),
    topics: log.topics.map((topic) => bytesToHex(topic)) as [Hex, ...Hex[]],
  });
  // The log wakes the workflow; current contract state authorizes the action.
  return processEvent(runtime, client(), event.args.vault);
}

function initWorkflow(config: Config) {
  return [
    handler(new CronCapability().trigger({ schedule: "0 * * * * *" }), onCron),
    handler(
      client().logTrigger({
        addresses: [hexToBase64(config.receiver)],
        topics: [
          {
            values: [
              hexToBase64(toEventSelector("LifecycleRequested(address,uint8)")),
            ],
          },
        ],
        confidence: "CONFIDENCE_LEVEL_FINALIZED",
      }),
      onRequest,
    ),
  ];
}

export async function main() {
  const runner = await Runner.newRunner({ configSchema });
  await runner.run(initWorkflow);
}

main();
