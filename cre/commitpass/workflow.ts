import {
  CronCapability,
  EVMClient,
  TxStatus,
  bytesToHex,
  getNetwork,
  handler,
  hexToBase64,
  type EVMLog,
  type Runtime,
} from "@chainlink/cre-sdk";
import { EVM_PB } from "@chainlink/cre-sdk/pb";
import {
  encodeAbiParameters,
  getAddress,
  toEventSelector,
  zeroHash,
  type Address,
} from "viem";
import {
  AUTOMATION_ACTION,
  MONAD_TESTNET,
  reportParameters,
} from "@commitpass/shared";
import { CommitPassFactory } from "../contracts/evm/ts/generated/CommitPassFactory";
import { CommitPassVault } from "../contracts/evm/ts/generated/CommitPassVault";
import { getAttendanceSnapshot } from "./attendance";
import { signSimulationPayload } from "./simulation";
import type { Config } from "./config";

export { configSchema } from "./config";

const createEVMClient = (): EVMClient => {
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: MONAD_TESTNET.selectorName,
    isTestnet: true,
  });
  if (!network)
    throw new Error("Monad testnet is unavailable in this CRE runtime");
  return new EVMClient(network.chainSelector.selector);
};

const processEvent = (
  runtime: Runtime<Config>,
  evmClient: EVMClient,
  vaultAddress: Address,
): string => {
  const factory = new CommitPassFactory(evmClient, runtime.config.factory);
  if (!factory.isVault(runtime, vaultAddress))
    throw new Error("Unknown event vault");

  // Read finalized state, then skip requests already executed or not yet due.
  const vault = new CommitPassVault(evmClient, vaultAddress);
  const [eventId, action, cutoff] = vault.getState(runtime);
  if (action === 0) return "not due";
  if (action !== AUTOMATION_ACTION.start && action !== AUTOMATION_ACTION.settle)
    throw new Error("Unsupported lifecycle action");

  // Settlement requires the authenticated, consensus-agreed attendance snapshot.
  const snapshot =
    action === AUTOMATION_ACTION.settle
      ? getAttendanceSnapshot(runtime, vaultAddress, eventId, cutoff)
      : { attendees: [] as Address[], hash: zeroHash };
  const payload = encodeAbiParameters(reportParameters, [
    BigInt(MONAD_TESTNET.chainId),
    vaultAddress,
    action,
    BigInt(runtime.now().getTime()) / 1000n + 300n,
    action === AUTOMATION_ACTION.settle ? cutoff : 0n,
    snapshot.hash,
    snapshot.attendees,
  ]);

  // The generated binding creates the CRE report and sends it to this vault.
  const result = vault.writeReport(
    runtime,
    signSimulationPayload(runtime, vaultAddress, payload),
    { gasLimit: runtime.config.gasLimit },
  );
  if (
    result.txStatus !== TxStatus.SUCCESS ||
    result.receiverContractExecutionStatus !==
      EVM_PB.ReceiverContractExecutionStatus.SUCCESS ||
    result.txHash?.length !== 32 ||
    !result.txHash.some((byte) => byte !== 0)
  ) {
    throw new Error(
      `Lifecycle write failed for ${vaultAddress}: tx=${result.txStatus}, receiver=${result.receiverContractExecutionStatus}`,
    );
  }
  const txHash = bytesToHex(result.txHash);
  runtime.log(
    `Lifecycle action ${action} confirmed for ${vaultAddress}; tx=${txHash}`,
  );
  return txHash;
};

export const onCronTrigger = (runtime: Runtime<Config>): string => {
  const evmClient = createEVMClient();
  const factory = new CommitPassFactory(evmClient, runtime.config.factory);
  const slot = BigInt(runtime.now().getTime()) / 60_000n;
  const vaults = factory.getBatch(runtime, slot);
  let failures = 0;
  for (const vault of vaults) {
    try {
      processEvent(runtime, evmClient, vault);
    } catch {
      failures++;
      // Capability errors may contain authenticated request details.
      runtime.log(`Deferred lifecycle action for ${vault}`);
    }
  }
  if (failures > 0)
    throw new Error(
      `${failures} lifecycle action(s) deferred; retry on a subsequent sweep`,
    );
  return "sweep completed";
};

export const onLifecycleRequested = (
  runtime: Runtime<Config>,
  log: EVMLog,
): string => {
  if (getAddress(bytesToHex(log.address)) !== runtime.config.factory)
    throw new Error("Unexpected log source");
  const evmClient = createEVMClient();
  const factory = new CommitPassFactory(evmClient, runtime.config.factory);
  const event = factory.decodeLifecycleRequested(log);
  // The request log wakes CRE; current vault state remains authoritative.
  return processEvent(runtime, evmClient, event.data.vault);
};

export function initWorkflow(config: Config) {
  const cron = new CronCapability();
  const evmClient = createEVMClient();
  return [
    handler(cron.trigger({ schedule: config.schedule }), onCronTrigger),
    handler(
      evmClient.logTrigger({
        addresses: [hexToBase64(config.factory)],
        topics: [
          {
            values: [
              hexToBase64(toEventSelector("LifecycleRequested(address,uint8)")),
            ],
          },
        ],
        confidence: "CONFIDENCE_LEVEL_FINALIZED",
      }),
      onLifecycleRequested,
    ),
  ];
}
