"use client";
import { useCallback, useEffect, useState } from "react";
import {
  eventVaultAbi,
  eventAutomationAbi,
  factoryAbi,
} from "@commitpass/shared";
import {
  chainClient,
  factoryAddress,
  automationAddress,
  assetAddress,
} from "@/lib/chain";
import type { Address } from "viem";
import { isLocal } from "@/lib/runtime-network";

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
    automation,
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
    chainClient.readContract({ ...at, functionName: "ASSET_TOKEN" }),
    chainClient.readContract({ ...at, functionName: "automation" }),
    chainClient.readContract({ ...at, functionName: "depositedToYield" }),
    chainClient.readContract({ ...at, functionName: "eventSettled" }),
    chainClient.readContract({ ...at, functionName: "registrationClosed" }),
    chainClient.readContract({ ...at, functionName: "getParticipantCount" }),
    chainClient.readContract({ ...at, functionName: "maxParticipant" }),
    chainClient.readContract({ ...at, functionName: "stakeAmount" }),
    chainClient.readContract({ ...at, functionName: "registrationDeadline" }),
    chainClient.readContract({ ...at, functionName: "eventDate" }),
    chainClient.readContract({
      address: automationAddress,
      abi: eventAutomationAbi,
      functionName: "schedules",
      args: [vault],
      blockNumber: block.number,
    }),
    isLocal
      ? chainClient.readContract({ ...at, functionName: "settlementOutcome" })
      : Promise.resolve(0),
    isLocal
      ? chainClient.readContract({ ...at, functionName: "protocolRevenue" })
      : Promise.resolve(0n),
    isLocal
      ? chainClient.readContract({ ...at, functionName: "totalAllocated" })
      : Promise.resolve(0n),
    isLocal
      ? chainClient.readContract({ ...at, functionName: "totalClaimed" })
      : Promise.resolve(0n),
  ]);
  if (
    !known ||
    asset.toLowerCase() !== assetAddress.toLowerCase() ||
    automation.toLowerCase() !== automationAddress.toLowerCase() ||
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
