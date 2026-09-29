"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Plus,
  Search,
  Ticket,
  Users,
} from "lucide-react";
import type { EventPage, EventSummary } from "@commitpass/shared";
import {
  amount,
  dateLabel,
  eventTitle,
  jsonRequest,
  shorten,
  statusLabel,
  timeLabel,
} from "@/lib/events";
import { useAccount } from "./account-context";
import { EventCover } from "./event-cover";

export function EventList({ personal = false }: { personal?: boolean }) {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { session, connecting, error: accountError, refresh } = useAccount();
  const [rows, setRows] = useState<EventSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [after, setAfter] = useState("");
  const [role, setRole] = useState("all");
  const [tab, setTab] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (personal && (!ready || !session)) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const query = new URLSearchParams({
          after,
          role,
          scope: personal ? "mine" : "all",
        });
        const token = personal ? await getAccessToken() : null;
        const result = await jsonRequest<EventPage>(`/api/events?${query}`, {
          signal: controller.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (controller.signal.aborted) return;
        setRows((current) =>
          after
            ? Array.from(
                new Map(
                  [...current, ...result.data].map((event) => [
                    event.id,
                    event,
                  ]),
                ).values(),
              )
            : result.data,
        );
        setCursor(result.nextCursor);
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : "Could not load events.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [personal, ready, session?.id, after, role, getAccessToken, attempt]);
  const visible = rows
    .filter((event) => {
      const past =
        ["SETTLED", "REFUNDED", "CANCELLED"].includes(event.status) ||
        Number(event.settleAt || event.startAt) * 1000 < Date.now();
      return (
        (tab === "past" ? past : !past) &&
        `${eventTitle(event)} ${event.metadata?.location ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    })
    .sort(
      (a, b) =>
        (Number(a.startAt) - Number(b.startAt)) * (tab === "past" ? -1 : 1),
    );
  return (
    <main id="workspace-main" className="workspace-content">
      <div className="workspace-title">
        <div>
          <h1>{personal ? "Events" : "Discover events"}</h1>
          <p>
            {personal
              ? "Your plans, all in one place."
              : "Find something worth showing up for."}
          </p>
        </div>
        <Link className="button button--dark" href="/events/new">
          <Plus size={16} />
          Create event
        </Link>
      </div>
      <div className="list-toolbar">
        <div className="segmented" aria-label="Event dates">
          {["upcoming", "past"].map((value) => (
            <button
              key={value}
              className={tab === value ? "selected" : ""}
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
            >
              {value === "upcoming" ? "Upcoming" : "Past"}
            </button>
          ))}
        </div>
        {personal ? (
          <select
            aria-label="Your role"
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setAfter("");
              setRows([]);
            }}
          >
            <option value="all">All events</option>
            <option value="hosting">Hosting</option>
            <option value="going">Going</option>
          </select>
        ) : (
          <label className="event-search">
            <Search size={16} />
            <input
              aria-label="Search loaded events"
              placeholder="Search events"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        )}
      </div>
      {(personal && !ready) || (personal && connecting) ? (
        <LoadingEvents />
      ) : personal && !authenticated ? (
        <EmptyEvents
          title="Your next plan starts here."
          description="Sign in to see the events you’re hosting and attending."
          href="/signin?next=%2Fevents"
          action="Sign in to CommitPass"
        />
      ) : personal && accountError ? (
        <LoadError message={accountError} retry={refresh} />
      ) : error ? (
        <LoadError
          message={error}
          retry={() => setAttempt((value) => value + 1)}
        />
      ) : loading && !rows.length ? (
        <LoadingEvents />
      ) : (
        <>
          {visible.length ? (
            <div className="event-timeline">
              {visible.map((event) => (
                <article key={event.id} className="timeline-row">
                  <div className="timeline-date">
                    <strong>
                      {dateLabel(event.startAt, {
                        month: "short",
                        day: "numeric",
                      })}
                    </strong>
                    <span>{dateLabel(event.startAt, { weekday: "long" })}</span>
                  </div>
                  <Link
                    className="timeline-card"
                    href={`/events/${event.vault}`}
                  >
                    <div className="timeline-info">
                      <p>{timeLabel(event.startAt)}</p>
                      <h2>{eventTitle(event)}</h2>
                      <span>
                        <Users size={14} />
                        {session?.wallets.some(
                          (wallet) =>
                            wallet.toLowerCase() === event.owner.toLowerCase(),
                        )
                          ? "Hosted by you"
                          : `Hosted by ${shorten(event.organizer)}`}
                      </span>
                      <span>
                        <MapPin size={14} />
                        {event.metadata?.location || "Location to be announced"}
                      </span>
                      <div className="event-chips">
                        <span>{statusLabel(event)}</span>
                        <span>
                          {amount(event.stakeAmount)} mockAUSD commitment
                        </span>
                      </div>
                      {event.metadataUnavailable && (
                        <small>
                          Some event details are temporarily unavailable.
                        </small>
                      )}
                    </div>
                    <EventCover
                      small
                      title={eventTitle(event)}
                      posterUrl={event.metadata?.posterUrl}
                    />
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <EmptyEvents
              title={
                search
                  ? "No matching events."
                  : tab === "past"
                    ? "The memories go here."
                    : personal
                      ? "A little space for your next plan."
                      : "Good things are on their way."
              }
              description={
                search
                  ? "Try another search, or load more events below."
                  : tab === "past"
                    ? "Finished events will appear here."
                    : personal
                      ? "Create something worth showing up for, or discover your next community."
                      : "There are no published events to show yet. You could host the first one."
              }
              href={personal ? "/discover" : "/events/new"}
              action={personal ? "Discover events" : "Create an event"}
            />
          )}
          {cursor && (
            <button
              className="button load-more"
              disabled={loading}
              onClick={() => setAfter(cursor)}
            >
              {loading ? "Loading…" : "Load more events"}
            </button>
          )}
        </>
      )}
      {personal && authenticated && (
        <Link className="draft-link" href="/events/new">
          <CalendarDays size={17} />
          <span>
            Have an idea?
            <small>Create an event or continue your saved draft.</small>
          </span>
          <ArrowRight size={18} />
        </Link>
      )}
    </main>
  );
}
export function EmptyEvents({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="workspace-empty">
      <div className="empty-ticket" aria-hidden="true">
        <Ticket size={56} strokeWidth={1} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="button" href={href}>
        {action}
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
export function LoadError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="workspace-error" role="alert">
      <h2>We couldn’t load that.</h2>
      <p>{message}</p>
      <button className="button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
function LoadingEvents() {
  return (
    <div
      className="event-skeletons"
      aria-busy="true"
      aria-label="Loading events"
    >
      <div />
      <div />
      <div />
    </div>
  );
}
