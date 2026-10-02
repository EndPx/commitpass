"use client";
import { useCallback, useEffect, useState } from "react";
import { eventVaultAbi, factoryAbi } from "@commitpass/shared";
import { chainClient, factoryAddress, assetAddress } from "@/lib/chain";
import type { Address } from "viem";

export async function readEventState(vault: Address) {
  const block = await chainClient.getBlock();
  const at = {
    address: vault,
    abi: eventVaultAbi,
    blockNumber: block.number,
  } as const;
  const [
    known,
    owner,
    asset,
    creatingFactory,
    started,
    settled,
    closed,
    count,
    capacity,
    stake,
    deadline,
    start,
    schedule,
    outcome,
    revenue,
    allocated,
    claimed,
  ] = await Promise.all([
    chainClient.readContract({
      address: factoryAddress,
      abi: factoryAbi,
      functionName: "isVault",
      args: [vault],
      blockNumber: block.number,
    }),
    chainClient.readContract({ ...at, functionName: "owner" }),
    chainClient.readContract({ ...at, functionName: "USDC_TOKEN" }),
    chainClient.readContract({ ...at, functionName: "factory" }),
    chainClient.readContract({ ...at, functionName: "depositedToYield" }),
    chainClient.readContract({ ...at, functionName: "eventSettled" }),
    chainClient.readContract({ ...at, functionName: "registrationClosed" }),
    chainClient.readContract({ ...at, functionName: "getParticipantCount" }),
    chainClient.readContract({ ...at, functionName: "maxParticipant" }),
    chainClient.readContract({ ...at, functionName: "stakeAmount" }),
    chainClient.readContract({ ...at, functionName: "registrationDeadline" }),
    chainClient.readContract({ ...at, functionName: "eventDate" }),
    chainClient.readContract({ ...at, functionName: "getSchedule" }),
    chainClient.readContract({ ...at, functionName: "settlementOutcome" }),
    chainClient.readContract({ ...at, functionName: "protocolRevenue" }),
    chainClient.readContract({ ...at, functionName: "totalAllocated" }),
    chainClient.readContract({ ...at, functionName: "totalClaimed" }),
  ]);
  if (
    !known ||
    asset.toLowerCase() !== assetAddress.toLowerCase() ||
    creatingFactory.toLowerCase() !== factoryAddress.toLowerCase() ||
    schedule[0] === 0n
  )
    throw new Error("This event is not configured for CommitPass automation.");
  const cutoff = schedule[2] || schedule[1];
  const status =
    outcome === 3
      ? "CANCELLED"
      : outcome === 2
        ? "REFUNDED"
        : settled
          ? "SETTLED"
          : !started && count === 0n && block.timestamp >= schedule[1]
            ? "EMPTY_ENDED"
            : started && block.timestamp >= cutoff
              ? "SETTLEMENT_REQUESTED"
              : started
                ? "ACTIVE"
                : schedule[3] || block.timestamp >= start
                  ? "START_REQUESTED"
                  : "CREATED";
  return {
    outcome,
    revenue,
    allocated,
    claimed,
    owner,
    started,
    settled,
    closed,
    count,
    capacity,
    stake,
    deadline,
    start,
    cutoff,
    settleAt: schedule[1],
    startRequested: schedule[3],
    settlementRequested: schedule[2] > 0n,
    status,
    timestamp: block.timestamp,
    blockNumber: block.number,
  };
}
export type LiveEventState = Awaited<ReturnType<typeof readEventState>>;
export function useEventState(vault: Address) {
  const [value, setValue] = useState<LiveEventState | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setValue(null);
    async function load() {
      try {
        const state = await readEventState(vault);
        if (active) {
          setValue(state);
          setError("");
        }
      } catch {
        if (active)
          setError(
            "Live event status is unavailable. Actions are paused until it reconnects.",
          );
      } finally {
        if (active) timer = setTimeout(load, 15000);
      }
    }
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [vault, attempt]);
  return { value, error, refresh };
}
