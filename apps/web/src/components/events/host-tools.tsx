"use client";
import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePrivy } from "@privy-io/react-auth";
import { Check, Copy, QrCode, RefreshCw, Search, Users } from "lucide-react";
import type { EventSummary, IndexedParticipant } from "@commitpass/shared";
import { amount, isEmptyEventEnded, jsonRequest, shorten } from "@/lib/events";
import { ManagedEventEditor } from "./managed-event-editor";
const QrScanner = dynamic(
  () => import("./guest-qr-scanner").then((module) => module.GuestQrScanner),
  { ssr: false },
);

export function HostTools({
  event,
  refresh,
  lifecycle,
}: {
  event: EventSummary;
  refresh: () => void;
  lifecycle?: ReactNode;
}) {
  const [tab, setTab] = useState("details");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("guest"))
      setTab("participants");
  }, [event.vault]);
  return (
    <section className="host-tools host-workspace-tabs">
      <div
        className="host-tabs"
        role="tablist"
        aria-label="Manage event sections"
      >
        {[
          { id: "details", label: "Event details" },
          { id: "participants", label: "Participants" },
        ].map((item) => (
          <button
            key={item.id}
            id={`host-tab-${item.id}`}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`host-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            onKeyDown={(e) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
                return;
              e.preventDefault();
              const next =
                e.key === "Home"
                  ? "details"
                  : e.key === "End"
                    ? "participants"
                    : tab === "details"
                      ? "participants"
                      : "details";
              setTab(next);
              document.getElementById(`host-tab-${next}`)?.focus();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        id="host-panel-details"
        role="tabpanel"
        aria-labelledby="host-tab-details"
        hidden={tab !== "details"}
      >
        <ManagedEventEditor key={event.vault} event={event} refresh={refresh} />
        <div className="managed-lifecycle">
          <h3>Event controls</h3>
          {lifecycle}
        </div>
      </div>
      <div
        id="host-panel-participants"
        role="tabpanel"
        aria-labelledby="host-tab-participants"
        hidden={tab !== "participants"}
      >
        {tab === "participants" && (
          <ParticipantsPanel key={event.vault} event={event} />
        )}
      </div>
    </section>
  );
}
function ParticipantsPanel({ event }: { event: EventSummary }) {
  const { getAccessToken } = usePrivy();
  const [participants, setParticipants] = useState<IndexedParticipant[]>([]),
    [checked, setChecked] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  async function guestNames(wallets: string[], token: string) {
    if (!wallets.length) return {};
    const result = await jsonRequest<{ names: Record<string, string> }>(
      `/api/events/${event.vault}/guest-profiles?wallets=${encodeURIComponent(wallets.join(","))}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    setNames((current) => ({ ...current, ...result.names }));
    return result.names;
  }
  const [cursor, setCursor] = useState<string | null>(null),
    [indexedStatus, setIndexedStatus] = useState("");
  const [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [scanOpen, setScanOpen] = useState(false);
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [copied, setCopied] = useState("");
  useEffect(() => {
    const guest = new URLSearchParams(window.location.search).get("guest");
    if (guest && /^0x[\da-f]{40}$/i.test(guest)) setSearch(guest);
    void loadGuests();
  }, [event.vault, event.status]);
  useEffect(() => {
    if (
      !["SETTLED", "CANCELLED", "REFUNDED"].includes(event.status) ||
      indexedStatus === event.status ||
      busy
    )
      return;
    const timer = setTimeout(() => void loadGuests(), 4000);
    return () => clearTimeout(timer);
  }, [event.status, indexedStatus, busy]);
  async function loadGuests(after = "") {
    setBusy(true);
    setError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Please sign in again.");
      const indexed = await jsonRequest<{ data: EventSummary }>(
        `/api/events/${event.vault}`,
      );
      const [people, attendance] = await Promise.all([
        jsonRequest<{ data: IndexedParticipant[]; nextCursor: string | null }>(
          `/api/events/${event.vault}/participants?after=${encodeURIComponent(after)}`,
        ),
        jsonRequest<{ checkIns: { wallet: string }[] }>(
          `/api/events/${event.vault}/check-ins`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      ]);
      setParticipants((current) =>
        after
          ? Array.from(
              new Map(
                [...current, ...people.data].map((person) => [
                  person.id,
                  person,
                ]),
              ).values(),
            )
          : people.data,
      );
      setCursor(people.nextCursor);
      setChecked(attendance.checkIns.map((item) => item.wallet.toLowerCase()));
      setLoaded(true);
      setIndexedStatus(indexed.data.status);
      await guestNames(
        people.data.map((person) => person.wallet),
        token,
      );
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Could not load participants.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function checkIn(person: IndexedParticipant) {
    if (
      busy ||
      checked.includes(person.wallet.toLowerCase()) ||
      event.status !== "ACTIVE"
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Please sign in again.");
      await jsonRequest(
        `/api/events/${event.vault}/check-ins/${person.wallet}`,
        { method: "PUT", headers: { Authorization: `Bearer ${token}` } },
      );
      setChecked((current) => [
        ...new Set([...current, person.wallet.toLowerCase()]),
      ]);
      setMessage(
        `${names[person.wallet.toLowerCase()] || "Guest"} checked in.`,
      );
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Could not record attendance.",
      );
    } finally {
      setBusy(false);
    }
  }
  const terminal = ["SETTLED", "CANCELLED", "REFUNDED"].includes(event.status);
  const isPresent = (person: IndexedParticipant) =>
    event.status === "SETTLED" && indexedStatus === event.status
      ? person.attended
      : checked.includes(person.wallet.toLowerCase()) || person.attended;
  const visible = participants.filter(
    (person) =>
      (person.wallet.toLowerCase().includes(search.trim().toLowerCase()) ||
        (names[person.wallet.toLowerCase()] || "")
          .toLowerCase()
          .includes(search.trim().toLowerCase())) &&
      (filter === "all" ||
        (filter === "checked" ? isPresent(person) : !isPresent(person))),
  );
  return (
    <section
      className="participants-panel"
      aria-label="Participants and check-in"
    >
      <div className="participants-heading">
        <div>
          <h3>Participants</h3>
          <p>
            {loaded
              ? `${participants.length}${cursor ? "+" : ""} reservations · ${checked.length} checked in`
              : "Loading reservations…"}
          </p>
        </div>
        <button className="button" onClick={() => setScanOpen(true)}>
          <QrCode size={17} />
          Scan QR
        </button>
      </div>
      <div className="participants-toolbar">
        <label className="participant-search">
          <Search size={17} />
          <input
            type="search"
            aria-label="Search participant name or wallet"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or wallet"
          />
        </label>
        <select
          aria-label="Attendance filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All participants</option>
          <option value="checked">Checked in</option>
          <option value="waiting">Not checked in</option>
        </select>
        <button
          className="participant-refresh"
          aria-label="Refresh participants"
          disabled={busy}
          onClick={() => void loadGuests()}
        >
          <RefreshCw size={17} />
        </button>
      </div>
      {event.status !== "ACTIVE" && (
        <p className="participant-checkin-note">
          {terminal || isEmptyEventEnded(event)
            ? "Check-in is closed for this event."
            : "Check-in opens once the event starts."}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
      <div className="participant-table-scroll">
        <table className="participant-table">
          <thead>
            <tr>
              <th>Participant</th>
              <th>Commitment</th>
              <th>Attendance</th>
              <th>Return</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((person) => {
              const present = isPresent(person);
              return (
                <tr
                  key={person.id}
                  className={
                    search.toLowerCase() === person.wallet.toLowerCase()
                      ? "selected"
                      : ""
                  }
                >
                  <td>
                    <div className="participant-wallet">
                      <span className="host-avatar" aria-hidden="true">
                        {(names[person.wallet.toLowerCase()] || "Guest")
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                      <div className="participant-identity">
                        <strong>
                          {names[person.wallet.toLowerCase()] || "Guest"}
                        </strong>
                        <code title={person.wallet}>
                          {shorten(person.wallet)}
                        </code>
                      </div>
                      <button
                        aria-label={`Copy wallet ${shorten(person.wallet)}`}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(person.wallet);
                            setCopied(person.wallet);
                          } catch {
                            setError("Could not copy the wallet.");
                          }
                        }}
                      >
                        {copied === person.wallet ? (
                          <Check size={14} />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                  </td>
                  <td>
                    {amount(person.amount)} <small>USDC</small>
                  </td>
                  <td>
                    <span
                      className={`participant-status ${present ? "present" : ""}`}
                    >
                      {terminal && indexedStatus !== event.status
                        ? "Updating…"
                        : present
                          ? "Checked in"
                          : event.status === "SETTLED"
                            ? "No-show"
                            : "Not checked in"}
                    </span>
                  </td>
                  <td>
                    {terminal && indexedStatus !== event.status
                      ? "Updating…"
                      : person.claimed
                        ? "Collected"
                        : terminal
                          ? BigInt(person.claimableAmount) > 0n
                            ? `${amount(person.claimableAmount)} USDC available`
                            : "No return"
                          : "After event ends"}
                  </td>
                  <td>
                    <button
                      className="participant-checkin"
                      disabled={busy || present || event.status !== "ACTIVE"}
                      onClick={() => void checkIn(person)}
                    >
                      {present ? (
                        <>
                          <Check size={14} />
                          Checked in
                        </>
                      ) : (
                        "Check in"
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!visible.length && (
              <tr>
                <td colSpan={5}>
                  <div className="participant-empty">
                    <Users size={28} />
                    <strong>
                      {!loaded
                        ? error
                          ? "Participants unavailable."
                          : "Loading participants…"
                        : search || filter !== "all"
                          ? "No matching participants."
                          : "No reservations yet."}
                    </strong>
                    <p>
                      {search || filter !== "all"
                        ? cursor
                          ? "Load more participants or clear your filters."
                          : "Try another name or wallet, or clear your filters."
                        : "Guests will appear here after their commitment is confirmed."}
                    </p>
                    {(search || filter !== "all") && (
                      <button
                        className="button"
                        onClick={() => {
                          setSearch("");
                          setFilter("all");
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {cursor && (
        <button
          className="button participants-more"
          disabled={busy}
          onClick={() => void loadGuests(cursor)}
        >
          Load more participants
        </button>
      )}
      <span className="sr-only" role="status">
        {copied ? "Wallet address copied" : ""}
      </span>
      {scanOpen && (
        <QrScanner
          vault={event.vault}
          onCheckIn={async (wallet) => {
            const token = await getAccessToken();
            if (!token) throw new Error("Please sign in again.");
            const profile = await guestNames([wallet], token);
            const name = profile[wallet.toLowerCase()] || "Guest";
            await jsonRequest(
              `/api/events/${event.vault}/check-ins/${wallet}`,
              {
                method: "PUT",
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            setChecked((current) => [
              ...new Set([...current, wallet.toLowerCase()]),
            ]);
            setMessage(`${name} checked in.`);
            return { name };
          }}
          onClose={() => setScanOpen(false)}
        />
      )}
    </section>
  );
}
