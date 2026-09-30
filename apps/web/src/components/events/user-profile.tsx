"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { ArrowUpRight, RefreshCw, UserRound } from "lucide-react";
import { erc20Abi, type Address } from "viem";
import type {
  ProfilePage,
  ProfilePosition,
  ProfileSummary,
} from "@commitpass/shared";
import {
  amount,
  dateLabel,
  eventTitle,
  jsonRequest,
  shorten,
} from "@/lib/events";
import { assetAddress, chainClient, explorer } from "@/lib/chain";
import { useAccount } from "./account-context";
import { EventCover } from "./event-cover";
import { EmptyEvents, LoadError } from "./event-list";

type Record = { accountId: string; kind: string; page: ProfilePage };
export function UserProfile() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const {
    session,
    connecting,
    error: accountError,
    refresh: refreshAccount,
  } = useAccount();
  const [record, setRecord] = useState<Record | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kind, setKind] = useState("all");
  const [after, setAfter] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [balance, setBalance] = useState<{
    accountId: string;
    value: string | null;
  } | null>(null);
  const wallets = session?.wallets.join(",") ?? "";
  const accountId = session?.id;
  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Please sign in again.");
        const page = await jsonRequest<ProfilePage>(
          `/api/profile?${new URLSearchParams({ kind, after })}`,
          {
            signal: controller.signal,
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (controller.signal.aborted) return;
        setRecord((current) => ({
          accountId,
          kind,
          page: {
            ...page,
            data:
              after && current?.accountId === accountId && current.kind === kind
                ? Array.from(
                    new Map(
                      [...current.page.data, ...page.data].map((row) => [
                        row.id,
                        row,
                      ]),
                    ).values(),
                  )
                : page.data,
          },
        }));
      } catch (value) {
        if (!controller.signal.aborted)
          setError(
            value instanceof Error
              ? value.message
              : "Could not load your activity.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [accountId, kind, after, attempt, getAccessToken]);
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    setBalance(null);
    const addresses = wallets ? wallets.split(",") : [];
    void Promise.all(
      addresses.map((wallet) =>
        chainClient.readContract({
          address: assetAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [wallet as Address],
        }),
      ),
    )
      .then((values) => {
        if (active)
          setBalance({
            accountId,
            value: values.reduce((sum, value) => sum + value, 0n).toString(),
          });
      })
      .catch(() => {
        if (active) setBalance({ accountId, value: null });
      });
    return () => {
      active = false;
    };
  }, [accountId, wallets, attempt]);
  const current = accountId && record?.accountId === accountId ? record : null;
  const page = current?.page;
  const positions = current?.kind === kind ? page?.data : undefined;
  const walletBalance = balance?.accountId === accountId ? balance : undefined;
  const name = user?.google?.name || "My profile";
  const email = user?.google?.email || user?.email?.address;
  const refresh = () => {
    setAfter("");
    setAttempt((value) => value + 1);
  };
  let content;
  if (!ready || connecting)
    content = (
      <p className="profile-loading" role="status">
        Loading your profile…
      </p>
    );
  else if (!authenticated)
    content = (
      <EmptyEvents
        title="Your story starts here."
        description="Sign in to see your events, attendance, and returns."
        href="/signin?next=%2Fprofile"
        action="Sign in"
        icon={<UserRound size={30} />}
      />
    );
  else if (accountError)
    content = <LoadError message={accountError} retry={refreshAccount} />;
  else if (!page)
    content = error ? (
      <LoadError message={error} retry={refresh} />
    ) : (
      <p className="profile-loading" role="status">
        Loading your activity…
      </p>
    );
  else
    content = (
      <>
        {error && (
          <div className="profile-error" role="alert">
            <p>{error}</p>
            <button className="button button--small" onClick={refresh}>
              Try again
            </button>
          </div>
        )}
        <section className="profile-funds" aria-label="Your USDC funds">
          <Fund
            label="Wallet balance"
            value={
              !session?.wallets.length
                ? "No wallet yet"
                : !walletBalance
                  ? "Loading…"
                  : walletBalance.value === null
                    ? "Unavailable"
                    : amount(walletBalance.value)
            }
            token={!!walletBalance?.value && !!session?.wallets.length}
          />
          <Fund
            label="Committed"
            value={amount(page.summary.committedAmount)}
            note="Locked in active events"
          />
          <Fund
            label="To collect"
            value={amount(page.summary.claimableAmount)}
            note="Available after settlement"
            highlight={BigInt(page.summary.claimableAmount) > 0n}
          />
          <Fund
            label="Received"
            value={amount(page.summary.receivedAmount)}
            note="Confirmed claims"
          />
        </section>
        <section
          className="profile-participation"
          aria-label="Your participation"
        >
          <div>
            <strong>{page.summary.eventsJoined}</strong>
            <span>Events joined</span>
          </div>
          <div>
            <strong>{page.summary.eventsHosted}</strong>
            <span>Events hosted</span>
          </div>
          <div>
            <strong>
              {page.summary.settledEvents
                ? `${Math.round((page.summary.eventsAttended / page.summary.settledEvents) * 100)}%`
                : "—"}
            </strong>
            <span>Attendance</span>
            <small>
              {page.summary.settledEvents
                ? `${page.summary.eventsAttended} of ${page.summary.settledEvents} settled events`
                : "Recorded after settlement"}
            </small>
          </div>
        </section>
        <ProfileCharts summary={page.summary} />
        <section aria-labelledby="profile-activity-heading">
          <div className="profile-activity-heading">
            <h2 id="profile-activity-heading">Your activity</h2>
            <div className="plans-role-filter" aria-label="Activity filter">
              {[
                { id: "all", name: "All" },
                { id: "claimable", name: "To collect" },
                { id: "received", name: "Received" },
              ].map((filter) => (
                <button
                  key={filter.id}
                  aria-pressed={kind === filter.id}
                  className={kind === filter.id ? "selected" : ""}
                  onClick={() => {
                    setKind(filter.id);
                    setAfter("");
                  }}
                >
                  {filter.name}
                </button>
              ))}
            </div>
          </div>
          {!positions || (loading && !positions.length) ? (
            <p className="profile-loading" role="status">
              Loading activity…
            </p>
          ) : positions.length ? (
            <div className="profile-positions">
              {positions.map((position) => (
                <Position key={position.id} position={position} />
              ))}
            </div>
          ) : (
            <div className="profile-activity-empty">
              <p>
                {kind === "claimable"
                  ? "No returns to collect right now."
                  : kind === "received"
                    ? "Your received returns will appear here."
                    : "Your commitments and returns will appear here."}
              </p>
              {kind === "all" && (
                <Link className="button button--small" href="/discover">
                  Discover events <ArrowUpRight size={15} />
                </Link>
              )}
            </div>
          )}
          {page.nextCursor && current?.kind === kind && (
            <div className="plans-pagination">
              <button
                className="button"
                disabled={loading}
                onClick={() => setAfter(page.nextCursor!)}
              >
                {loading ? "Loading…" : "Load more activity"}
              </button>
            </div>
          )}
        </section>
        <p className="profile-settlement-note">
          After an event settles, collect your return on its event page. Funds
          reach your wallet when the claim confirms. Activity may take a moment
          to update.
        </p>
        {!!session?.wallets.length && (
          <div className="profile-wallets">
            <span>Your linked wallets</span>
            {session.wallets.map((wallet) => (
              <a
                href={`${explorer}/address/${wallet}`}
                key={wallet}
                target="_blank"
                rel="noreferrer"
              >
                {shorten(wallet)} <ArrowUpRight size={13} />
              </a>
            ))}
          </div>
        )}
      </>
    );
  return (
    <main className="workspace-content profile-page" id="workspace-main">
      <div className="profile-heading">
        <div className="profile-identity">
          <span className="profile-avatar" aria-hidden="true">
            {name[0]?.toUpperCase()}
          </span>
          <div>
            <h1>{authenticated ? name : "Profile"}</h1>
            {authenticated && email && <p>{email}</p>}
          </div>
        </div>
        {authenticated && (
          <button
            className="profile-refresh"
            aria-label="Refresh profile"
            disabled={loading || connecting}
            onClick={refresh}
          >
            <RefreshCw size={17} />
          </button>
        )}
      </div>
      {content}
    </main>
  );
}
function Fund({
  label,
  value,
  note,
  token = true,
  highlight = false,
}: {
  label: string;
  value: string;
  note?: string;
  token?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? "profile-fund highlighted" : "profile-fund"}>
      <span>{label}</span>
      <strong>{value}</strong>
      {token && <small>USDC</small>}
      {note && <p>{note}</p>}
    </div>
  );
}
function Position({ position }: { position: ProfilePosition }) {
  const { event } = position;
  const claimable = BigInt(position.claimableAmount) > 0n;
  const terminal = ["SETTLED", "REFUNDED", "CANCELLED"].includes(event.status);
  const value = position.claimed
    ? position.claimedAmount
    : claimable
      ? position.claimableAmount
      : terminal
        ? "0"
        : position.amount;
  const state = position.claimed
    ? "Received"
    : claimable
      ? "To collect"
      : terminal
        ? "No return"
        : "Committed";
  return (
    <Link href={`/events/${event.vault}`} className="profile-position">
      <EventCover
        title={eventTitle(event)}
        posterUrl={event.metadata?.posterUrl}
        small
      />
      <div className="profile-position-info">
        <h3>{eventTitle(event)}</h3>
        <p>
          {dateLabel(event.startAt, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}{" "}
          · {shorten(position.wallet)}
        </p>
        <small>
          {event.status === "CANCELLED"
            ? "Event cancelled"
            : event.status === "REFUNDED"
              ? "Full refund"
              : event.status === "SETTLED"
                ? position.attended
                  ? "Attended"
                  : "No-show"
                : event.status === "ACTIVE"
                  ? "Event in progress"
                  : event.status === "SETTLEMENT_REQUESTED"
                    ? "Wrapping up"
                    : "Upcoming event"}
        </small>
      </div>
      <div
        className={`profile-position-return${claimable ? " available" : ""}`}
      >
        <strong>
          {amount(value)} <small>USDC</small>
        </strong>
        <span>
          {state}
          {claimable && <ArrowUpRight size={14} />}
        </span>
      </div>
    </Link>
  );
}

function ProfileCharts({ summary }: { summary: ProfileSummary }) {
  const rate = summary.settledEvents
    ? (summary.eventsAttended / summary.settledEvents) * 100
    : 0;
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1),
    );
    const key = date.toISOString().slice(0, 7);
    return {
      key,
      label: date.toLocaleDateString("en-US", {
        month: "short",
        timeZone: "UTC",
      }),
      events: summary.months.find((month) => month.month === key)?.events ?? 0,
    };
  });
  const highest = Math.max(1, ...months.map((month) => month.events));
  return (
    <section className="profile-charts" aria-label="Your participation charts">
      <figure className="profile-chart">
        <figcaption>
          Showing up <small>Finalized attendance</small>
        </figcaption>
        <div className="profile-attendance-chart">
          <div className="profile-ring">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="var(--line)"
                strokeWidth="9"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="9"
                pathLength="100"
                strokeDasharray={`${rate} 100`}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <strong>
              {summary.settledEvents ? `${Math.round(rate)}%` : "—"}
            </strong>
          </div>
          <dl className="profile-chart-legend">
            <div>
              <dt>
                <i />
                Attended
              </dt>
              <dd>{summary.eventsAttended}</dd>
            </div>
            <div>
              <dt>
                <i />
                No-show
              </dt>
              <dd>{summary.settledEvents - summary.eventsAttended}</dd>
            </div>
          </dl>
        </div>
        <p>
          {summary.settledEvents
            ? "Cancelled and fully refunded events are excluded."
            : "Your attendance chart starts after your first settlement."}
        </p>
      </figure>
      <figure className="profile-chart">
        <figcaption>
          Monthly activity <small>Events committed to</small>
        </figcaption>
        <ol
          className="profile-bars"
          aria-label="Registrations over the past six months in UTC"
        >
          {months.map((month) => (
            <li
              key={month.key}
              aria-label={`${month.key}: ${month.events} events`}
            >
              <span>{month.events}</span>
              <div className="profile-bar-track">
                <i style={{ height: `${(month.events / highest) * 112}px` }} />
              </div>
              <small>{month.label}</small>
            </li>
          ))}
        </ol>
        <p>
          {months.some((month) => month.events)
            ? "Each event is counted once, at your first commitment. Dates use UTC."
            : "Commit to an event to start your activity chart."}
        </p>
      </figure>
    </section>
  );
}
