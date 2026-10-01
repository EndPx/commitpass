"use client";
import { useEffect, useState } from "react";

import { usePrivy } from "@privy-io/react-auth";
import { EmptyEvents, LoadError } from "./event-list-states";
export { EmptyEvents, LoadError } from "./event-list-states";
import type { EventPage, EventSummary } from "@commitpass/shared";
import { dateLabel, jsonRequest } from "@/lib/events";
import { useAccount } from "./account-context";
import { usePreferences } from "./preferences";
import { EventListCard } from "./event-list-card";
import { DiscoverEvents } from "./discover-events";

export function EventList({ personal = false }: { personal?: boolean }) {
  return personal ? <PersonalEvents /> : <DiscoverEvents />;
}
function PersonalEvents() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { timezone } = usePreferences();
  const { session, connecting, error: accountError, refresh } = useAccount();
  const [rows, setRows] = useState<EventSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [after, setAfter] = useState("");
  const [role, setRole] = useState("all");
  const [tab, setTab] = useState("upcoming");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!ready || !session) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const query = new URLSearchParams({ after, role, scope: "mine" });
        const token = await getAccessToken();
        if (!token) throw new Error("Please sign in again.");
        const result = await jsonRequest<EventPage>(`/api/events?${query}`, {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
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
      } catch (value) {
        if (!controller.signal.aborted)
          setError(
            value instanceof Error ? value.message : "Could not load events.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [ready, session?.id, after, role, getAccessToken, attempt]);
  const visible = rows
    .filter((event) => {
      const past =
        ["SETTLED", "REFUNDED", "CANCELLED"].includes(event.status) ||
        Number(event.settleAt || event.startAt) * 1000 < now;
      return tab === "past" ? past : !past;
    })
    .sort(
      (a, b) =>
        (Number(a.startAt) - Number(b.startAt)) * (tab === "past" ? -1 : 1),
    );
  const groups = new Map<string, EventSummary[]>();
  for (const event of visible) {
    const day = dateLabel(event.startAt, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    });
    groups.set(day, [...(groups.get(day) ?? []), event]);
  }
  const hosting = (event: EventSummary) =>
    !!session?.wallets.some(
      (wallet) => wallet.toLowerCase() === event.owner.toLowerCase(),
    );
  let content;
  if (!ready || connecting) content = <LoadingEvents />;
  else if (!authenticated)
    content = (
      <EmptyEvents
        title="Your plans belong here."
        description="Sign in to see the events you’re hosting and the spots you’ve reserved."
        href="/signin?next=%2Fevents"
        action="Sign in"
      />
    );
  else if (accountError)
    content = <LoadError message={accountError} retry={refresh} />;
  else if (error)
    content = (
      <LoadError
        message={error}
        retry={() => setAttempt((value) => value + 1)}
      />
    );
  else if (loading && !rows.length) content = <LoadingEvents />;
  else
    content = (
      <>
        {visible.length ? (
          <div className="plans-timeline">
            {Array.from(groups.entries()).map(([day, events]) => (
              <section
                className="plans-date-group"
                key={day}
                aria-label={dateLabel(events[0]!.startAt, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  timeZone: timezone,
                })}
              >
                <div className="plans-date">
                  <strong>
                    {dateLabel(events[0]!.startAt, {
                      month: "short",
                      day: "numeric",
                      timeZone: timezone,
                    })}
                  </strong>
                  <span>
                    {dateLabel(events[0]!.startAt, {
                      weekday: "long",
                      timeZone: timezone,
                    })}
                  </span>
                </div>
                <div className="plans-day-cards">
                  {events.map((event) => (
                    <EventListCard
                      key={event.id}
                      event={event}
                      personal
                      hosting={hosting(event)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyEvents
            title={
              tab === "past"
                ? "The memories go here."
                : role === "hosting"
                  ? "Your next gathering starts here."
                  : "Nothing on your calendar yet."
            }
            description={
              tab === "past"
                ? "Your finished events will appear here."
                : role === "hosting"
                  ? "Create a plan and bring your people together."
                  : "Find a plan you’d love to be part of, then save your spot."
            }
            href={role === "hosting" ? "/events/new" : "/discover"}
            action={role === "hosting" ? "Create an event" : "Discover events"}
          />
        )}
        {cursor && (
          <div className="plans-pagination">
            <button
              className="button"
              disabled={loading}
              onClick={() => setAfter(cursor)}
            >
              {loading ? "Loading…" : "Load more events"}
            </button>
          </div>
        )}
      </>
    );
  return (
    <main id="workspace-main" className="workspace-content events-page">
      <div className="plans-heading">
        <h1>Events</h1>
        <div className="segmented" aria-label="Event dates">
          {["upcoming", "past"].map((value) => (
            <button
              key={value}
              aria-pressed={tab === value}
              className={tab === value ? "selected" : ""}
              onClick={() => setTab(value)}
            >
              {value === "upcoming" ? "Upcoming" : "Past"}
            </button>
          ))}
        </div>
      </div>
      <div className="plans-controls">
        <div className="plans-role-filter" aria-label="Your role">
          {["all", "hosting", "going"].map((value) => (
            <button
              key={value}
              aria-pressed={role === value}
              className={role === value ? "selected" : ""}
              onClick={() => {
                if (value === role) return;
                setLoading(true);
                setRole(value);
                setAfter("");
                setRows([]);
                setCursor(null);
              }}
            >
              {value === "all"
                ? "All events"
                : value === "hosting"
                  ? "Hosting"
                  : "Going"}
            </button>
          ))}
        </div>
        {!loading && !error && authenticated && (
          <span>
            {visible.length}
            {cursor ? "+" : ""} {tab}{" "}
            {visible.length === 1 ? "event" : "events"}
          </span>
        )}
      </div>
      {content}
    </main>
  );
}
function LoadingEvents() {
  return (
    <div
      className="plans-skeletons"
      aria-busy="true"
      aria-label="Loading events"
    >
      {[0, 1, 2].map((value) => (
        <div key={value}>
          <div />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
