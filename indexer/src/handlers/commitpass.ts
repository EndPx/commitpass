import { indexer, type EvmOnEventContext } from "envio";
import { AUTOMATION_ACTION } from "@commitpass/shared";

const fields = { transaction: ["hash"], block: ["timestamp", "hash"] } as const;
const eventKey = (chainId: number, vault: string) =>
  `${chainId}_${vault.toLowerCase()}`;
const participantKey = (eventId: string, wallet: string) =>
  `${eventId}_${wallet.toLowerCase()}`;
type Log = {
  chainId: number;
  srcAddress: string;
  logIndex: number;
  block: { number: number; timestamp: number; hash: string };
  transaction: { hash: string };
};

function activity(
  context: EvmOnEventContext,
  event: Log,
  id: string,
  kind: string,
  wallet: string | undefined = undefined,
  amount: bigint | undefined = undefined,
  snapshotHash: string | undefined = undefined,
) {
  context.ChainActivity.set({
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    event_id: id,
    kind,
    chainId: event.chainId,
    contract: event.srcAddress,
    blockNumber: BigInt(event.block.number),
    blockHash: event.block.hash,
    timestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
    logIndex: event.logIndex,
    wallet,
    amount,
    snapshotHash,
  });
}

function updated(event: Log) {
  return {
    updatedAt: BigInt(event.block.timestamp),
    lastBlock: BigInt(event.block.number),
    lastTransaction: event.transaction.hash,
  };
}

async function loadEvent(
  context: EvmOnEventContext,
  chainId: number,
  vault: string,
) {
  const entity = await context.CommitmentEvent.get(eventKey(chainId, vault));
  if (!entity && !context.isPreload)
    throw new Error(
      `Missing factory event for ${vault}; check deployment start block`,
    );
  return entity;
}

indexer.contractRegister(
  { contract: "CommitPassFactory", event: "VaultCreated" },
  async ({ event, context }) => {
    context.chain.CommitPassVault.add(event.params.vault);
  },
);

indexer.onEvent(
  { contract: "CommitPassFactory", event: "VaultCreated", fields },
  async ({ event, context }) => {
    const id = eventKey(event.chainId, event.params.vault);
    context.CommitmentEvent.set({
      id,
      chainId: event.chainId,
      vault: event.params.vault,
      eventId: event.params.eventId,
      organizer: event.params.organizer,
      owner: event.params.organizer,
      stakeAmount: event.params.stakeAmount,
      maxParticipant: event.params.maxParticipant,
      registrationDeadline: event.params.registrationDeadline,
      startAt: event.params.eventDate,
      settleAt: undefined,
      automation: undefined,
      status: "OPEN",
      registrationClosed: false,
      participantCount: 0,
      attendeeCount: 0,
      claimCount: 0,
      totalCommitted: 0n,
      yieldDeposited: 0n,
      totalYield: 0n,
      protocolFee: 0n,
      rewardPerAttendee: 0n,
      totalClaimed: 0n,
      snapshotHash: undefined,
      createdAt: BigInt(event.block.timestamp),
      ...updated(event),
    });
    activity(context, event, id, "CREATED");
  },
);

indexer.onEvent(
  { contract: "CommitPassVault", event: "DepositMade", fields },
  async ({ event, context }) => {
    const current = await loadEvent(context, event.chainId, event.srcAddress);
    if (!current) return;
    context.Participant.set({
      id: participantKey(current.id, event.params.participant),
      event_id: current.id,
      wallet: event.params.participant,
      amount: event.params.amount,
      attended: false,
      claimed: false,
      claimedAmount: 0n,
      depositedAt: BigInt(event.block.timestamp),
      depositTransaction: event.transaction.hash,
      claimTransaction: undefined,
    });
    context.CommitmentEvent.set({
      ...current,
      participantCount: current.participantCount + 1,
      totalCommitted: current.totalCommitted + event.params.amount,
      ...updated(event),
    });
    activity(
      context,
      event,
      current.id,
      "DEPOSITED",
      event.params.participant,
      event.params.amount,
    );
  },
);

indexer.onEvent(
  { contract: "CommitPassVault", event: "RegistrationClosed", fields },
  async ({ event, context }) => {
    const current = await loadEvent(context, event.chainId, event.srcAddress);
    if (!current) return;
    context.CommitmentEvent.set({
      ...current,
      registrationClosed: true,
      ...updated(event),
    });
    activity(context, event, current.id, "REGISTRATION_CLOSED");
  },
);

indexer.onEvent(
  { contract: "CommitPassVault", event: "AutomationConfigured", fields },
  async ({ event, context }) => {
    const current = await loadEvent(context, event.chainId, event.srcAddress);
    if (!current) return;
    context.CommitmentEvent.set({
      ...current,
      automation: event.params.automation,
      ...updated(event),
    });
    activity(context, event, current.id, "AUTOMATION_CONFIGURED");
  },
);

indexer.onEvent(
  { contract: "CommitPassVault", event: "DepositToYieldSource", fields },
  async ({ event, context }) => {
    const current = await loadEvent(context, event.chainId, event.srcAddress);
    if (!current) return;
    context.CommitmentEvent.set({
      ...current,
      status: "ACTIVE",
      registrationClosed: true,
      yieldDeposited: event.params.amount,
      ...updated(event),
    });
    activity(
      context,
      event,
      current.id,
      "STARTED",
      undefined,
      event.params.amount,
    );
  },
);

indexer.onEvent(
  { contract: "CommitPassVault", event: "AttendanceMarked", fields },
  async ({ event, context }) => {
    const id = eventKey(event.chainId, event.srcAddress);
    const [current, participant] = await Promise.all([
      loadEvent(context, event.chainId, event.srcAddress),
      context.Participant.get(participantKey(id, event.params.participant)),
    ]);
    if (!current || !participant) {
      if (!context.isPreload)
        throw new Error("Attendance references a missing deposit");
      return;
    }
    if (!participant.attended) {
      context.Participant.set({ ...participant, attended: true });
      context.CommitmentEvent.set({
        ...current,
        attendeeCount: current.attendeeCount + 1,
        ...updated(event),
      });
    }
    activity(
      context,
      event,
      id,
      "ATTENDANCE_SETTLED",
      event.params.participant,
    );
  },
);

indexer.onEvent(
  { contract: "CommitPassVault", event: "EventSettled", fields },
  async ({ event, context }) => {
    const current = await loadEvent(context, event.chainId, event.srcAddress);
    if (!current) return;
    const noShowStake =
      BigInt(current.participantCount - current.attendeeCount) *
      current.stakeAmount;
    const netYield = event.params.totalYield - event.params.protocolFee;
    const reward =
      current.attendeeCount === 0
        ? 0n
        : current.stakeAmount +
          (noShowStake + netYield) / BigInt(current.attendeeCount);
    context.CommitmentEvent.set({
      ...current,
      status: "SETTLED",
      totalYield: event.params.totalYield,
      protocolFee: event.params.protocolFee,
      rewardPerAttendee: reward,
      ...updated(event),
    });
    activity(
      context,
      event,
      current.id,
      "SETTLED",
      undefined,
      event.params.totalYield,
    );
  },
);

indexer.onEvent(
  { contract: "CommitPassVault", event: "RewardClaimed", fields },
  async ({ event, context }) => {
    const id = eventKey(event.chainId, event.srcAddress);
    const [current, participant] = await Promise.all([
      loadEvent(context, event.chainId, event.srcAddress),
      context.Participant.get(participantKey(id, event.params.participant)),
    ]);
    if (!current || !participant) {
      if (!context.isPreload)
        throw new Error("Claim references a missing deposit");
      return;
    }
    context.Participant.set({
      ...participant,
      claimed: true,
      claimedAmount: event.params.rewardAmount,
      claimTransaction: event.transaction.hash,
    });
    context.CommitmentEvent.set({
      ...current,
      claimCount: current.claimCount + 1,
      totalClaimed: current.totalClaimed + event.params.rewardAmount,
      ...updated(event),
    });
    activity(
      context,
      event,
      id,
      "CLAIMED",
      event.params.participant,
      event.params.rewardAmount,
    );
  },
);

indexer.onEvent(
  { contract: "CommitPassVault", event: "OwnershipTransferred", fields },
  async ({ event, context }) => {
    // Ownable emits a constructor log before VaultCreated; the factory records that initial owner.
    if (
      event.params.previousOwner ===
      "0x0000000000000000000000000000000000000000"
    )
      return;
    const current = await loadEvent(context, event.chainId, event.srcAddress);
    if (!current) return;
    context.CommitmentEvent.set({
      ...current,
      owner: event.params.newOwner,
      ...updated(event),
    });
    activity(
      context,
      event,
      current.id,
      "OWNER_CHANGED",
      event.params.newOwner,
    );
  },
);

indexer.onEvent(
  { contract: "CommitPassAutomation", event: "EventRegistered", fields },
  async ({ event, context }) => {
    const current = await loadEvent(context, event.chainId, event.params.vault);
    if (!current) return;
    context.CommitmentEvent.set({
      ...current,
      startAt: event.params.startAt,
      settleAt: event.params.settleAt,
      automation: event.srcAddress,
      ...updated(event),
    });
    activity(context, event, current.id, "SCHEDULE_REGISTERED");
  },
);

indexer.onEvent(
  { contract: "CommitPassAutomation", event: "LifecycleRequested", fields },
  async ({ event, context }) => {
    const current = await loadEvent(context, event.chainId, event.params.vault);
    if (!current) return;
    const start = Number(event.params.action) === AUTOMATION_ACTION.start;
    if (!start && Number(event.params.action) !== AUTOMATION_ACTION.settle)
      throw new Error("Unknown lifecycle action");
    // A request is not evidence of a completed start/settlement.
    context.CommitmentEvent.set({
      ...current,
      status: start ? "START_REQUESTED" : "SETTLEMENT_REQUESTED",
      ...updated(event),
    });
    activity(
      context,
      event,
      current.id,
      start ? "START_REQUESTED" : "SETTLEMENT_REQUESTED",
    );
  },
);

indexer.onEvent(
  { contract: "CommitPassAutomation", event: "LifecycleExecuted", fields },
  async ({ event, context }) => {
    const current = await loadEvent(context, event.chainId, event.params.vault);
    if (!current) return;
    const settled = Number(event.params.action) === AUTOMATION_ACTION.settle;
    context.CommitmentEvent.set({
      ...current,
      snapshotHash: settled ? event.params.snapshotHash : current.snapshotHash,
      ...updated(event),
    });
    activity(
      context,
      event,
      current.id,
      "CRE_EXECUTED",
      undefined,
      undefined,
      settled ? event.params.snapshotHash : undefined,
    );
  },
);
