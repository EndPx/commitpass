"use client";
import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type {
  EventMetadata,
  EventSummary,
  IndexedParticipant,
} from "@commitpass/shared";
import { jsonRequest, shorten } from "@/lib/events";
import { CoverUpload } from "./cover-upload";
export function HostTools({
  event,
  refresh,
}: {
  event: EventSummary;
  refresh: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const [metadata, setMetadata] = useState<EventMetadata>(
    event.metadata ?? {
      title: "",
      description: "",
      location: "",
      posterUrl: "",
    },
  );
  const [participants, setParticipants] = useState<IndexedParticipant[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState("");
  useEffect(() => {
    const guest = new URLSearchParams(window.location.search).get("guest");
    if (guest && /^0x[\da-f]{40}$/i.test(guest)) setSearch(guest);
    void loadGuests();
  }, [event.vault]);
  const visibleGuests = participants.filter((person) =>
    person.wallet.toLowerCase().includes(search.trim().toLowerCase()),
  );
  async function loadGuests(after = "") {
    setBusy(true);
    setError("");
    try {
      const token = await getAccessToken();
      const [people, checkIns] = await Promise.all([
        jsonRequest<{ data: IndexedParticipant[]; nextCursor: string | null }>(
          `/api/events/${event.vault}/participants?after=${encodeURIComponent(after)}`,
        ),
        jsonRequest<{ checkIns: { wallet: string }[] }>(
          `/api/events/${event.vault}/check-ins`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      ]);
      setParticipants((current) =>
        after ? [...current, ...people.data] : people.data,
      );
      setCursor(people.nextCursor);
      setChecked(
        checkIns.checkIns.map((record) => record.wallet.toLowerCase()),
      );
      setLoaded(true);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load guests.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="host-tools">
      <h2>Guest list & event details</h2>
      <details>
        <summary>Edit event details</summary>
        <form
          onSubmit={async (form) => {
            form.preventDefault();
            if (busy || coverUploading || event.metadataUnavailable) return;
            setBusy(true);
            setError("");
            setMessage("");
            try {
              const token = await getAccessToken();
              await jsonRequest(`/api/events/${event.vault}/metadata`, {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(metadata),
              });
              setMessage("Event details saved.");
              refresh();
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Could not save details.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Title
            <input
              value={metadata.title}
              maxLength={120}
              required
              onChange={(e) =>
                setMetadata({ ...metadata, title: e.target.value })
              }
            />
          </label>
          <label>
            Location
            <input
              value={metadata.location}
              maxLength={300}
              onChange={(e) =>
                setMetadata({ ...metadata, location: e.target.value })
              }
            />
          </label>
          <label>
            Description
            <textarea
              rows={5}
              value={metadata.description}
              maxLength={5000}
              onChange={(e) =>
                setMetadata({ ...metadata, description: e.target.value })
              }
            />
          </label>
          <CoverUpload
            value={metadata.posterUrl}
            onChange={(url) =>
              setMetadata((current) => ({ ...current, posterUrl: url }))
            }
            disabled={busy}
            onBusyChange={setCoverUploading}
          />
          {event.metadataUnavailable && (
            <p className="form-error">
              Event details could not be loaded. Reconnect before saving to
              avoid replacing existing details.
            </p>
          )}
          <button
            className="button"
            disabled={busy || coverUploading || event.metadataUnavailable}
          >
            Save details
          </button>
        </form>
      </details>
      <details open>
        <summary>Guests & check-in</summary>
        <p>
          Open a guest’s QR pass to find their reservation, then confirm their
          presence here. A pass alone is not proof of attendance.
        </p>
        <div className="guest-list-summary">
          <strong>
            {loaded ? `${checked.length} checked in` : "Loading attendance…"}
          </strong>
          <span>
            {participants.length} reservations loaded
            {cursor ? " · more available" : ""}
          </span>
        </div>
        <label className="guest-search">
          Find a guest
          <input
            value={search}
            placeholder="Wallet address or CommitPass link"
            onChange={(e) => {
              const value = e.target.value;
              try {
                const url = new URL(value);
                const guest = url.searchParams.get("guest");
                if (
                  url.origin === window.location.origin &&
                  url.pathname.toLowerCase() ===
                    `/events/${event.vault}/manage`.toLowerCase() &&
                  guest &&
                  /^0x[\da-f]{40}$/i.test(guest)
                ) {
                  setSearch(guest);
                  return;
                }
              } catch {
                /* Plain wallet/search text. */
              }
              setSearch(value);
            }}
          />
        </label>
        {visibleGuests.map((person) => (
          <div className="guest-checkin" key={person.id}>
            <span title={person.wallet}>
              {shorten(person.wallet)}
              <small>
                {person.claimed
                  ? "Return claimed"
                  : ["CANCELLED", "REFUNDED"].includes(event.status)
                    ? "Refund available"
                    : person.attended
                      ? "Attendance settled"
                      : event.status === "SETTLED"
                        ? "No-show · no refund"
                        : "Commitment confirmed"}
              </small>
              <button
                className="guest-copy"
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(person.wallet);
                    setCopied(person.wallet);
                  } catch {
                    setError("Could not copy the wallet address.");
                  }
                }}
              >
                {copied === person.wallet ? "Copied" : "Copy wallet"}
              </button>
            </span>
            <button
              disabled={
                busy ||
                checked.includes(person.wallet.toLowerCase()) ||
                event.status !== "ACTIVE"
              }
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const token = await getAccessToken();
                  await jsonRequest(
                    `/api/events/${event.vault}/check-ins/${person.wallet}`,
                    {
                      method: "PUT",
                      headers: { Authorization: `Bearer ${token}` },
                    },
                  );
                  setChecked((current) => [
                    ...current,
                    person.wallet.toLowerCase(),
                  ]);
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Could not record attendance.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {checked.includes(person.wallet.toLowerCase())
                ? "Checked in"
                : "Check in"}
            </button>
          </div>
        ))}
        {loaded && participants.length > 0 && !visibleGuests.length && (
          <p>
            No matching guest in the loaded reservations.
            {cursor ? " Load more guests to continue searching." : ""}
          </p>
        )}
        {loaded && !participants.length && <p>No committed guests yet.</p>}
        {cursor && (
          <button
            className="button"
            disabled={busy}
            onClick={() => loadGuests(cursor)}
          >
            Load more guests
          </button>
        )}
        <button
          className="auth-text-button"
          disabled={busy}
          onClick={() => loadGuests()}
        >
          {busy ? "Loading…" : "Refresh guests"}
        </button>
      </details>
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
    </section>
  );
}
