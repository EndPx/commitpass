"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import {
  ArrowRight,
  CalendarDays,
  Compass,
  Plus,
  Search,
  SlidersHorizontal,
  Ticket,
  X,
} from "lucide-react";
import type { EventPage, EventSummary } from "@commitpass/shared";
import { dateLabel, eventTitle, jsonRequest } from "@/lib/events";
import brandMedia from "@/lib/brand-media.json";
import { coverImageUrl } from "@/lib/media";
import { useAccount } from "./account-context";
import { EventListCard, eventFormat, hasOpenSpots } from "./event-list-card";

export function EventList({ personal = false }: { personal?: boolean }) {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { session, connecting, error: accountError, refresh } = useAccount();
  const [rows, setRows] = useState<EventSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [after, setAfter] = useState("");
  const [role, setRole] = useState("all");
  const [tab, setTab] = useState("upcoming");
  const [format, setFormat] = useState("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
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
  }, [personal, ready, session?.id, after, role, getAccessToken, attempt]);

  const visible = rows
    .filter((event) => {
      const past =
        ["SETTLED", "REFUNDED", "CANCELLED"].includes(event.status) ||
        Number(event.settleAt || event.startAt) * 1000 < now;
      const dateMatches =
        tab === "past"
          ? past
          : !past &&
            (tab !== "week" ||
              Number(event.startAt) * 1000 <= now + 7 * 86400000);
      return (
        dateMatches &&
        `${eventTitle(event)} ${event.metadata?.location ?? ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()) &&
        (format === "all" || eventFormat(event) === format) &&
        (!openOnly || hasOpenSpots(event, now))
      );
    })
    .sort(
      (a, b) =>
        (Number(a.startAt) - Number(b.startAt)) * (tab === "past" ? -1 : 1),
    );
  const groups = new Map<string, EventSummary[]>();
  for (const event of visible) {
    const day = new Date(Number(event.startAt) * 1000).toDateString();
    groups.set(day, [...(groups.get(day) ?? []), event]);
  }
  const filtered = !!search || format !== "all" || openOnly || tab === "week";
  const resetFilters = () => {
    setSearch("");
    setFormat("all");
    setOpenOnly(false);
    setTab("upcoming");
  };
  const hosting = (event: EventSummary) =>
    !!session?.wallets.some(
      (wallet) => wallet.toLowerCase() === event.owner.toLowerCase(),
    );

  let content;
  if (personal && (!ready || connecting)) content = <LoadingEvents personal />;
  else if (personal && !authenticated)
    content = (
      <EmptyEvents
        title="Your plans belong here."
        description="Sign in to see the events you’re hosting and the spots you’ve reserved."
        href="/signin?next=%2Fevents"
        action="Sign in"
      />
    );
  else if (personal && accountError)
    content = <LoadError message={accountError} retry={refresh} />;
  else if (error)
    content = (
      <LoadError
        message={error}
        retry={() => setAttempt((value) => value + 1)}
      />
    );
  else if (loading && !rows.length)
    content = <LoadingEvents personal={personal} />;
  else
    content = (
      <>
        {visible.length ? (
          personal ? (
            <div className="plans-timeline">
              {Array.from(groups.entries()).map(([day, events]) => {
                const first = events[0];
                if (!first) return null;
                return (
                  <section
                    className="plans-date-group"
                    key={day}
                    aria-label={dateLabel(first.startAt)}
                  >
                    <div className="plans-date">
                      <strong>
                        {dateLabel(first.startAt, {
                          month: "short",
                          day: "numeric",
                        })}
                      </strong>
                      <span>
                        {dateLabel(first.startAt, { weekday: "long" })}
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
                );
              })}
            </div>
          ) : (
            <div className="discover-grid">
              {visible.map((event) => (
                <EventListCard key={event.id} event={event} />
              ))}
            </div>
          )
        ) : filtered ? (
          <div className="plans-no-results">
            <Search size={28} strokeWidth={1.5} />
            <h2>No plans match just yet.</h2>
            <p>
              {cursor
                ? "Try a different search or loosen your filters, or load more events below."
                : "Try a different search or loosen your filters."}
            </p>
            <button className="button" onClick={resetFilters}>
              Clear filters
            </button>
          </div>
        ) : personal ? (
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
        ) : (
          <DiscoverEmpty past={tab === "past"} />
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
            <small>Search and filters apply to the events loaded so far.</small>
          </div>
        )}
      </>
    );

  return (
    <main
      id="workspace-main"
      className={`workspace-content ${personal ? "events-page" : "discover-page"}`}
    >
      {personal ? (
        <>
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
        </>
      ) : (
        <>
          <div className="discover-heading">
            <div>
              <h1>Discover</h1>
              <p>Find your people. Make a plan worth keeping.</p>
            </div>
            <Link href="/events/new" className="discover-host-link">
              <Plus size={16} /> Host an event
            </Link>
          </div>
          <label className="discover-search">
            <Search size={20} />
            <input
              type="search"
              aria-label="Search loaded events by name or place"
              placeholder="Search events or places"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
              >
                <X size={17} />
              </button>
            )}
          </label>
          <div className="discover-filters">
            <label>
              <CalendarDays size={16} />
              <select
                aria-label="Event dates"
                value={tab}
                onChange={(event) => {
                  setTab(event.target.value);
                  if (event.target.value === "past") setOpenOnly(false);
                }}
              >
                <option value="upcoming">Upcoming</option>
                <option value="week">Next 7 days</option>
                <option value="past">Past events</option>
              </select>
            </label>
            <label>
              <Compass size={16} />
              <select
                aria-label="Event format"
                value={format}
                onChange={(event) => setFormat(event.target.value)}
              >
                <option value="all">Any format</option>
                <option value="in-person">In person</option>
                <option value="online">Online</option>
              </select>
            </label>
            <button
              aria-pressed={openOnly}
              disabled={tab === "past"}
              className={openOnly ? "selected" : ""}
              onClick={() => setOpenOnly((value) => !value)}
            >
              <SlidersHorizontal size={16} /> Spots available
            </button>
            {filtered && (
              <button className="filter-reset" onClick={resetFilters}>
                Reset
              </button>
            )}
          </div>
          <div className="discover-results-heading">
            <h2>
              {search
                ? "Search results"
                : tab === "past"
                  ? "Past gatherings"
                  : tab === "week"
                    ? "Happening soon"
                    : "Plans to look forward to"}
            </h2>
            {!loading && !error && (
              <span aria-live="polite">
                {visible.length}
                {cursor ? "+" : ""} {visible.length === 1 ? "event" : "events"}
              </span>
            )}
          </div>
        </>
      )}
      {content}
      {personal && authenticated && (
        <Link className="plans-host-prompt" href="/events/new">
          <CalendarDays size={18} />
          <span>
            Bring your people together.
            <small>Create an event or pick up your saved draft.</small>
          </span>
          <ArrowRight size={17} />
        </Link>
      )}
    </main>
  );
}

function DiscoverEmpty({ past }: { past: boolean }) {
  return (
    <div className="discover-empty">
      <div className="discover-empty-art" aria-hidden="true">
        {brandMedia.templates.slice(0, 3).map((cover) => (
          <img
            key={cover.url}
            src={coverImageUrl(cover.url, 320)}
            alt=""
            loading="lazy"
          />
        ))}
      </div>
      <h2>
        {past
          ? "Every good plan leaves a memory."
          : "Good plans start with someone."}
      </h2>
      <p>
        {past
          ? "Past events will appear here once they’ve finished."
          : "There are no published events here yet. Bring your community together and create the first one."}
      </p>
      <Link className="button" href="/events/new">
        Host a gathering <ArrowRight size={16} />
      </Link>
    </div>
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
    <div className="workspace-empty plans-empty">
      <div className="plans-empty-icon" aria-hidden="true">
        <Ticket size={30} strokeWidth={1.4} />
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
function LoadingEvents({ personal }: { personal: boolean }) {
  return (
    <div
      className={
        personal ? "plans-skeletons" : "discover-grid discover-skeletons"
      }
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
