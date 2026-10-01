import type {
  IndexedEvent,
  IndexedParticipant,
  VaultInsights,
} from "@commitpass/shared";
import { ApiError, apiRead } from "./server-api";

type ParticipantPage = {
  data: Array<IndexedParticipant & { claimedAmount: string }>;
  nextCursor: string | null;
};
function units(value: string) {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value))
    throw new ApiError(503);
  return BigInt(value);
}

export async function vaultInsights(vault: string): Promise<VaultInsights> {
  const signal = AbortSignal.timeout(15000);
  const seen = new Set<string>();
  let after = "";
  let available = 0n,
    returned = 0n,
    eligible = 0,
    collected = 0;
  // Fully aggregate at most 2,000 participants; never return partial figures.
  for (let page = 0; page < 20; page++) {
    const result = await apiRead<ParticipantPage>(
      `/v1/events/${vault}/participants?${new URLSearchParams({ after })}`,
      { signal },
    );
    if (!Array.isArray(result.data)) throw new ApiError(503);
    for (const person of result.data) {
      if (seen.has(person.id)) throw new ApiError(503);
      seen.add(person.id);
      const pending = units(person.claimableAmount),
        received = units(person.claimedAmount);
      available += pending;
      returned += received;
      if (pending + received > 0n) eligible++;
      if (person.claimed && received > 0n) collected++;
    }
    if (!result.nextCursor) {
      const { data: event } = await apiRead<{ data: IndexedEvent }>(
        `/v1/events/${vault}`,
        { signal },
      );
      return {
        source: "envio",
        event,
        availableToCollect: available.toString(),
        returnedToWallets: returned.toString(),
        totalAllocated: (available + returned).toString(),
        eligibleReturns: eligible,
        collectedReturns: collected,
      };
    }
    if (result.nextCursor === after) throw new ApiError(503);
    after = result.nextCursor;
  }
  throw new ApiError(503);
}
