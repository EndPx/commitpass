"use client";
import { useState, type FormEvent } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  AlignLeft,
  CalendarDays,
  Clock3,
  ImagePlus,
  LockKeyhole,
  MapPin,
  Palette,
  Pencil,
  Ticket,
  Users,
} from "lucide-react";
import {
  DEFAULT_EVENT_APPEARANCE,
  type EventMetadata,
  type EventSummary,
} from "@commitpass/shared";
import {
  amount,
  dateLabel,
  eventTitle,
  jsonRequest,
  timeLabel,
} from "@/lib/events";
import { utcOffset } from "@/lib/display-time";
import { usePreferences } from "./preferences";
import { FieldEditorDialog } from "./field-editors";
import { CoverEditor, ThemeEditor } from "./appearance-editors";

export function ManagedEventEditor({
  event,
  refresh,
}: {
  event: EventSummary;
  refresh: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const { timezone: viewerTimezone } = usePreferences();
  const [metadata, setMetadata] = useState<EventMetadata>(
    event.metadata ?? {
      title: eventTitle(event),
      description: "",
      location: "",
      posterUrl: "",
    },
  );
  const [editor, setEditor] = useState<
    "location" | "description" | "cover" | "theme" | null
  >(null);
  const [theme, setTheme] = useState(
    metadata.appearance ?? DEFAULT_EVENT_APPEARANCE,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const timezone = metadata.timezone || viewerTimezone;
  const close = () => setEditor(null);
  const change = (value: Partial<EventMetadata>) => {
    setMetadata((current) => ({ ...current, ...value }));
    setMessage("");
  };
  async function save(form: FormEvent) {
    form.preventDefault();
    if (busy || event.metadataUnavailable) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Please sign in again.");
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
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Could not save details.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form className="managed-event-editor create-fields" onSubmit={save}>
        <fieldset disabled={busy || event.metadataUnavailable}>
          <label className="sr-only" htmlFor="manage-event-title">
            Event name
          </label>
          <input
            id="manage-event-title"
            className="event-name-input"
            placeholder="Event name"
            value={metadata.title}
            required
            maxLength={120}
            onChange={(e) => change({ title: e.target.value })}
          />
          <div className="managed-schedule">
            <CalendarDays size={19} />
            <div>
              {[
                { label: "Start", value: event.startAt },
                { label: "End", value: event.settleAt },
              ].map(
                ({ label, value }) =>
                  value && (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>
                        {dateLabel(value, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          timeZone: timezone,
                        })}
                      </strong>
                      <span>{timeLabel(value, timezone)}</span>
                    </div>
                  ),
              )}
            </div>
            <small>
              {utcOffset(new Date(Number(event.startAt) * 1000), timezone)}
              <span>{timezone.replaceAll("_", " ")}</span>
            </small>
          </div>
          <button
            type="button"
            className="field-trigger managed-field"
            onClick={() => setEditor("location")}
          >
            <MapPin size={18} />
            <span>
              <strong>{metadata.location || "Add event location"}</strong>
              <small>Offline location or virtual link</small>
            </span>
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className="field-trigger managed-field"
            onClick={() => setEditor("description")}
          >
            <AlignLeft size={18} />
            <span>
              <strong>
                {metadata.description ? "Description" : "Add description"}
              </strong>
              {metadata.description && <small>{metadata.description}</small>}
            </span>
            <Pencil size={14} />
          </button>
          <div className="managed-look-fields">
            <button
              type="button"
              className="field-trigger managed-field"
              onClick={() => setEditor("cover")}
            >
              <ImagePlus size={18} />
              <span>Cover photo</span>
              <Pencil size={14} />
            </button>
            <button
              type="button"
              className="field-trigger managed-field"
              onClick={() => {
                setTheme(metadata.appearance ?? DEFAULT_EVENT_APPEARANCE);
                setEditor("theme");
              }}
            >
              <Palette size={18} />
              <span>Theme</span>
              <Pencil size={14} />
            </button>
          </div>
          <div className="managed-options-heading">
            <span>Event options</span>
            <small>
              <LockKeyhole size={12} />
              Fixed after creation
            </small>
          </div>
          <dl className="managed-options">
            <div>
              <dt>
                <Ticket size={17} />
                Commitment
              </dt>
              <dd>{amount(event.stakeAmount)} USDC</dd>
            </div>
            <div>
              <dt>
                <Clock3 size={17} />
                Registration closes
              </dt>
              <dd>
                {dateLabel(event.registrationDeadline, {
                  month: "short",
                  day: "numeric",
                  timeZone: timezone,
                })}{" "}
                · {timeLabel(event.registrationDeadline, timezone)}
              </dd>
            </div>
            <div>
              <dt>
                <Users size={17} />
                Capacity
              </dt>
              <dd>{event.maxParticipant} guests</dd>
            </div>
          </dl>
        </fieldset>
        {event.metadataUnavailable && (
          <p className="form-error">
            Event details are unavailable. Reconnect before saving.
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
        <button
          className="button button--dark managed-save"
          disabled={busy || event.metadataUnavailable}
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>
      {(editor === "location" || editor === "description") && (
        <FieldEditorDialog
          field={editor}
          value={metadata[editor]}
          start={new Date(Number(event.startAt) * 1000)
            .toISOString()
            .slice(0, 16)}
          timezone={timezone}
          onClose={close}
          onConfirm={(value) => {
            change({ [editor]: value });
            close();
          }}
        />
      )}
      {editor === "cover" && (
        <CoverEditor
          value={metadata.posterUrl}
          onClose={close}
          onConfirm={(posterUrl) => {
            change({ posterUrl });
            close();
          }}
        />
      )}
      {editor === "theme" && (
        <ThemeEditor
          value={theme}
          onChange={setTheme}
          onClose={close}
          onConfirm={() => {
            change({ appearance: theme });
            close();
          }}
        />
      )}
    </>
  );
}
