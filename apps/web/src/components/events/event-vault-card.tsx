"use client";
import { useEffect, useId, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Landmark,
  RefreshCw,
} from "lucide-react";
import type { EventSummary, VaultInsights } from "@commitpass/shared";
import {
  amount,
  dateLabel,
  isEmptyEventEnded,
  jsonRequest,
  timeLabel,
} from "@/lib/events";
import { explorer } from "@/lib/chain";
import { utcOffset } from "@/lib/display-time";
import { usePreferences } from "./preferences";

function percent(numerator: bigint, denominator: bigint) {
  return denominator > 0n
    ? Math.min(100, Number((numerator * 10000n) / denominator) / 100)
    : 0;
}
export function EventVaultCard({ event }: { event: EventSummary }) {
  const { timezone } = usePreferences();
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const [record, setRecord] = useState<{
    vault: string;
    data: VaultInsights;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function update() {
      try {
        if (document.visibilityState === "hidden") return;
        setLoading(true);
        const data = await jsonRequest<VaultInsights>(
          `/api/events/${event.vault}/vault-insights`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setRecord({ vault: event.vault, data });
          setError("");
        }
      } catch {
        if (!controller.signal.aborted)
          setError("Vault activity couldn’t update.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          timer = setTimeout(update, 60000);
        }
      }
    }
    setError("");
    void update();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [event.vault, event.lastTransaction, attempt]);
  const data = record?.vault === event.vault ? record.data : null;
  const snapshot = data?.event ?? event;
  const emptyEnded = isEmptyEventEnded(snapshot);
  const ended =
    emptyEnded ||
    ["SETTLED", "REFUNDED", "CANCELLED"].includes(snapshot.status);
  const started =
    !!snapshot.yieldDeposited && BigInt(snapshot.yieldDeposited) > 0n;
  const capacity = percent(
    BigInt(snapshot.participantCount),
    BigInt(snapshot.maxParticipant),
  );
  const returned = data ? BigInt(data.returnedToWallets) : 0n;
  const allocated = data ? BigInt(data.totalAllocated) : 0n;
  const claimedPercent = percent(returned, allocated);
  const state = emptyEnded
    ? "Event ended · no reservations"
    : !ended
      ? started
        ? "Event in progress"
        : snapshot.participantCount
          ? "Commitments received"
          : "Waiting for commitments"
      : !data
        ? "Event ended"
        : BigInt(data.availableToCollect) > 0n
          ? "Returns ready"
          : returned > 0n
            ? "Returns collected"
            : "No returns allocated";
  return (
    <section className="event-vault-card" aria-label="Event vault">
      <div className="event-vault-heading">
        <Landmark size={17} />
        <h2>Event vault</h2>
        <span className="vault-source">
          <i />
          Envio
        </span>
        <button
          className="vault-mobile-toggle"
          aria-label={expanded ? "Hide vault details" : "Show vault details"}
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((value) => !value)}
        >
          <ChevronDown size={18} />
        </button>
      </div>
      {!expanded && (
        <div className="vault-mobile-summary">
          <span>Spots committed</span>
          <strong>
            {snapshot.participantCount} / {snapshot.maxParticipant}
          </strong>
        </div>
      )}
      <div
        id={detailsId}
        className={`vault-details${expanded ? " is-expanded" : ""}`}
      >
        <div className="event-vault-address">
          <code>{event.vault}</code>
          <a
            href={`${explorer}/address/${event.vault}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Open event vault on Monadscan"
            title="Open vault on Monadscan"
          >
            <ArrowUpRight size={18} />
          </a>
        </div>
        <div className="vault-total">
          <span>Total committed</span>
          <strong>
            {snapshot.totalCommitted !== undefined
              ? amount(snapshot.totalCommitted)
              : "—"}
            <small>USDC</small>
          </strong>
          <p>{state}</p>
        </div>
        <ol className="vault-flow" aria-label="Vault progress">
          {[
            { label: "Commitments", done: snapshot.participantCount > 0 },
            {
              label: emptyEnded
                ? "Event ended"
                : snapshot.status === "CANCELLED"
                  ? "Cancelled"
                  : "Event",
              done: emptyEnded || started || snapshot.status === "CANCELLED",
            },
            { label: emptyEnded ? "No returns" : "Returns", done: ended },
          ].map((step) => (
            <li key={step.label} className={step.done ? "complete" : ""}>
              <span>{step.done ? <Check size={12} /> : <i />}</span>
              {step.label}
            </li>
          ))}
        </ol>
        <dl className="vault-financials">
          <VaultMetric
            label="Ready to collect"
            value={
              !ended
                ? "After event ends"
                : data
                  ? amount(data.availableToCollect)
                  : "—"
            }
            token={ended}
            highlight={ended && !!data && BigInt(data.availableToCollect) > 0n}
          />
          <VaultMetric
            label="Returned to wallets"
            value={data ? amount(data.returnedToWallets) : "—"}
          />
          <VaultMetric
            label="Extra earnings"
            value={
              !ended
                ? "After event ends"
                : snapshot.totalYield !== undefined
                  ? amount(snapshot.totalYield)
                  : "—"
            }
            token={ended}
          />
          <VaultMetric
            label="Platform share"
            value={
              !ended
                ? "After event ends"
                : snapshot.protocolFee !== undefined
                  ? amount(snapshot.protocolFee)
                  : "—"
            }
            token={ended}
          />
        </dl>
        <div className="vault-distribution">
          <div className="vault-distribution-heading">
            <strong>
              {emptyEnded
                ? "No guest returns"
                : ended
                  ? "Returns collected"
                  : "Spots committed"}
            </strong>
            <span>
              {ended
                ? data
                  ? `${data.collectedReturns} / ${data.eligibleReturns}`
                  : "—"
                : `${snapshot.participantCount} / ${snapshot.maxParticipant}`}
            </span>
          </div>
          <div
            className="vault-distribution-track"
            role="progressbar"
            aria-label={
              ended
                ? "Share of allocated USDC returned to wallets"
                : "Guest capacity filled"
            }
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              ended ? (data ? claimedPercent : undefined) : capacity
            }
            aria-valuetext={
              ended
                ? data
                  ? `${amount(data.returnedToWallets)} of ${amount(data.totalAllocated)} USDC collected`
                  : "Data not available yet"
                : `${snapshot.participantCount} of ${snapshot.maxParticipant} guests`
            }
          >
            <span style={{ width: `${ended ? claimedPercent : capacity}%` }} />
          </div>
          <div className="vault-distribution-caption">
            {ended ? (
              data ? (
                allocated > 0n ? (
                  <>
                    <span>{amount(data.returnedToWallets)} USDC collected</span>
                    <span>
                      {amount(data.availableToCollect)} USDC available
                    </span>
                  </>
                ) : (
                  "No guest returns to collect."
                )
              ) : (
                "Loading return activity…"
              )
            ) : snapshot.participantCount ? (
              "Every reserved spot has a recorded commitment."
            ) : (
              "The first commitment will appear here."
            )}
          </div>
        </div>
        {error && (
          <p className="vault-insights-error" role="status">
            {error}
            <button
              aria-label="Refresh vault activity"
              onClick={() => setAttempt((value) => value + 1)}
            >
              <RefreshCw size={14} />
            </button>
          </p>
        )}
        <div className="vault-indexed-time">
          <span>{loading ? "Updating…" : "Indexed by Envio"}</span>
          {snapshot.updatedAt && (
            <time
              dateTime={new Date(
                Number(snapshot.updatedAt) * 1000,
              ).toISOString()}
              title={`${dateLabel(snapshot.updatedAt, { month: "short", day: "numeric", timeZone: timezone })} ${timeLabel(snapshot.updatedAt, timezone)} ${utcOffset(new Date(Number(snapshot.updatedAt) * 1000), timezone)}`}
            >
              {dateLabel(snapshot.updatedAt, {
                month: "short",
                day: "numeric",
                timeZone: timezone,
              })}{" "}
              · {timeLabel(snapshot.updatedAt, timezone)}
            </time>
          )}
        </div>
      </div>
    </section>
  );
}
function VaultMetric({
  label,
  value,
  token = true,
  highlight = false,
}: {
  label: string;
  value: ReactNode;
  token?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? "highlight" : ""}>
      <dt>{label}</dt>
      <dd>
        {value}
        {token && <small> USDC</small>}
      </dd>
    </div>
  );
}
