import type { EventSummary } from "@commitpass/shared";
import { formatUnits } from "viem";

export const eventTitle = (event: EventSummary) =>
  event.metadata?.title || `Event #${event.eventId}`;
export const shorten = (value: string) =>
  `${value.slice(0, 6)}…${value.slice(-4)}`;
export function amount(value: string, decimals = 6) {
  try {
    return formatUnits(BigInt(value), decimals);
  } catch {
    return "Unavailable";
  }
}
export function dateLabel(
  seconds: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  },
) {
  const date = new Date(Number(seconds) * 1000);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-US", options)
    : "Date unavailable";
}
export const timeLabel = (seconds: string, timezone?: string) =>
  new Date(Number(seconds) * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...(timezone ? { timeZone: timezone } : {}),
  });
export function statusLabel(event: EventSummary) {
  if (event.status === "CANCELLED") return "Cancelled";
  if (event.status === "REFUNDED") return "Refunds available";
  if (event.status === "SETTLED") return "Settled";
  if (event.status === "SETTLEMENT_REQUESTED") return "Wrapping up";
  if (event.status === "ACTIVE") return "In progress";
  if (event.status === "START_REQUESTED") return "Starting soon";
  if (
    event.registrationClosed ||
    Number(event.registrationDeadline) * 1000 <= Date.now()
  )
    return "Registration closed";
  if (BigInt(event.participantCount) >= BigInt(event.maxParticipant))
    return "Full";
  return "Registration open";
}
export async function jsonRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "Something went wrong. Please try again.",
    );
  return result as T;
}
