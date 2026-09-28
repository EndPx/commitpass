"use client";
import { useEffect, useState, type FormEvent } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  AlignLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe2,
  MapPin,
  Search,
  Ticket,
  Users,
  Video,
} from "lucide-react";
import { Temporal } from "@js-temporal/polyfill";
import { EditorDialog, DialogActions } from "./editor-dialog";
import { dateText, timeText, zoneOffset } from "@/lib/event-editor";

export type FieldEditor =
  | "description"
  | "location"
  | "capacity"
  | "commitment"
  | "deadline"
  | "start-date"
  | "start-time"
  | "end-date"
  | "end-time"
  | "timezone";
type Props = {
  field: FieldEditor;
  value: string;
  timezone: string;
  start: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
  anchor?: HTMLElement | null;
  error?: string;
};

export function FieldEditorDialog(props: Props) {
  if (props.field === "location") return <LocationEditor {...props} />;
  if (props.field.endsWith("-date")) return <DateEditor {...props} />;
  if (props.field.endsWith("-time")) return <TimeEditor {...props} />;
  if (props.field === "timezone") return <TimezoneEditor {...props} />;
  return <ValueEditor {...props} />;
}

function LocationEditor({ value, anchor, onConfirm, onClose }: Props) {
  const { user } = usePrivy();
  const [candidate, setCandidate] = useState(value);
  const [recent, setRecent] = useState<string[]>([]);
  const key = `commitpass:recent-locations:${user?.id ?? "guest"}`;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(saved))
        setRecent(
          saved
            .filter((item) => typeof item === "string" && item.length <= 300)
            .slice(0, 5),
        );
    } catch {
      /* Recent locations are optional. */
    }
  }, [key]);
  return (
    <EditorDialog title="Event location" anchor={anchor} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const next = candidate.trim();
          if (next) {
            try {
              localStorage.setItem(
                key,
                JSON.stringify(
                  [next, ...recent.filter((item) => item !== next)].slice(0, 5),
                ),
              );
            } catch {
              /* The location itself can still be confirmed. */
            }
          }
          onConfirm(next);
        }}
      >
        <input
          className="location-search-input"
          aria-label="Enter location or virtual link"
          autoFocus
          placeholder="Enter location or virtual link"
          value={candidate}
          onChange={(event) => setCandidate(event.target.value)}
          maxLength={300}
        />
        <div className="location-options">
          <p className="location-group-label">Recent locations</p>
          {recent
            .filter(
              (item) =>
                !candidate ||
                item.toLowerCase().includes(candidate.toLowerCase()),
            )
            .map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCandidate(item)}
              >
                <MapPin size={15} />
                {item}
              </button>
            ))}
          {!recent.length && (
            <p className="location-empty">No recently used locations.</p>
          )}
          <p className="location-group-label">Virtual options</p>
          <a href="https://zoom.us/" target="_blank" rel="noreferrer">
            <Video size={15} />
            Open Zoom
            <ArrowUpRight size={13} />
          </a>
          <a href="https://meet.google.com/" target="_blank" rel="noreferrer">
            <Video size={15} />
            Open Google Meet
            <ArrowUpRight size={13} />
          </a>
          <p className="editor-help">
            Already have a meeting link? Paste it above. New meetings are
            created on the provider’s website.
          </p>
        </div>
        <DialogActions
          onCancel={onClose}
          label={candidate ? "Use this location" : "Clear location"}
        />
      </form>
    </EditorDialog>
  );
}

function ValueEditor({
  field,
  value,
  start,
  onConfirm,
  onClose,
  error: parentError,
}: Props) {
  const [candidate, setCandidate] = useState(value);
  const [error, setError] = useState("");
  const config =
    field === "description"
      ? {
          title: "Event description",
          description:
            "Let people know what to expect, what to bring, and how to check in.",
          icon: <AlignLeft size={25} />,
        }
      : field === "location"
        ? {
            title: "Event location",
            description:
              "Add the full venue address or a link for a virtual event.",
            icon: <MapPin size={25} />,
          }
        : field === "capacity"
          ? {
              title: "Maximum capacity",
              description:
                "Registration closes when all spots are committed. Choose between 1 and 500 guests.",
              icon: <Users size={25} />,
            }
          : field === "commitment"
            ? {
                title: "Refundable commitment",
                description:
                  "Guests commit this amount to reserve a spot. It becomes claimable after confirmed attendance and settlement.",
                icon: <Ticket size={25} />,
              }
            : {
                title: "Registration deadline",
                description:
                  "Close registration before the event begins. Uses your selected event timezone.",
                icon: <Clock3 size={25} />,
              };
  function confirm(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (
      field === "capacity" &&
      (!/^\d+$/.test(candidate) ||
        Number(candidate) < 1 ||
        Number(candidate) > 500)
    ) {
      setError("Choose a whole number between 1 and 500.");
      return;
    }
    if (
      field === "commitment" &&
      (!/^\d+(\.\d{1,6})?$/.test(candidate) ||
        Number(candidate) <= 0 ||
        candidate.length > 30)
    ) {
      setError("Enter a positive amount with up to 6 decimal places.");
      return;
    }
    onConfirm(candidate.trim());
  }
  return (
    <EditorDialog
      title={config.title}
      description={config.description}
      icon={config.icon}
      onClose={onClose}
      wide={field === "description"}
    >
      <form onSubmit={confirm}>
        <label className="editor-field-label" htmlFor="editor-value">
          {field === "capacity"
            ? "Guest limit"
            : field === "commitment"
              ? "Amount"
              : field === "deadline"
                ? "Closes at"
                : config.title}
        </label>
        {field === "description" ? (
          <textarea
            id="editor-value"
            autoFocus
            className="editor-input editor-description-input"
            rows={8}
            value={candidate}
            onChange={(event) => setCandidate(event.target.value)}
            maxLength={5000}
            placeholder="What’s the plan?"
          />
        ) : (
          <div className="editor-input-wrap">
            <input
              id="editor-value"
              autoFocus
              className="editor-input"
              value={candidate}
              onChange={(event) => setCandidate(event.target.value)}
              type={
                field === "deadline"
                  ? "datetime-local"
                  : field === "capacity" || field === "commitment"
                    ? "number"
                    : "text"
              }
              min={
                field === "capacity"
                  ? 1
                  : field === "commitment"
                    ? 0.000001
                    : undefined
              }
              max={field === "capacity" ? 500 : undefined}
              step={
                field === "commitment"
                  ? 0.000001
                  : field === "capacity"
                    ? 1
                    : undefined
              }
              maxLength={field === "location" ? 300 : undefined}
              required={field !== "location"}
              placeholder={
                field === "location"
                  ? "Venue, address, or meeting link"
                  : undefined
              }
            />
            {field === "commitment" && <span>mockAUSD</span>}
          </div>
        )}
        {field === "deadline" && (
          <>
            <button
              type="button"
              className="editor-match-start"
              onClick={() => {
                setCandidate(start);
                setError("");
              }}
            >
              <Clock3 size={15} /> Same as start time
              <span>{timeText(start)}</span>
            </button>
            {candidate === start && (
              <p className="editor-help">
                Registration closes 1 second before the event starts.
              </p>
            )}
          </>
        )}
        {field === "description" && (
          <p className="editor-count">{candidate.length} / 5,000</p>
        )}
        {field === "commitment" && (
          <p className="editor-help">Testnet tokens have no monetary value.</p>
        )}
        {(error || parentError) && (
          <p className="form-error" role="alert">
            {error || parentError}
          </p>
        )}
        <DialogActions onCancel={onClose} />
      </form>
    </EditorDialog>
  );
}

function DateEditor({ field, value, onConfirm, onClose, error }: Props) {
  const initial = /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : Temporal.Now.plainDateISO().toString();
  const [candidate, setCandidate] = useState(initial);
  const [month, setMonth] = useState(
    Temporal.PlainYearMonth.from(initial.slice(0, 7)),
  );
  const first = month.toPlainDate({ day: 1 });
  return (
    <EditorDialog
      title={field.startsWith("start") ? "Start date" : "End date"}
      icon={<CalendarDays size={24} />}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(candidate);
        }}
      >
        <div className="calendar-month">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonth(month.subtract({ months: 1 }))}
          >
            <ChevronLeft size={18} />
          </button>
          <strong>
            {first.toLocaleString("en-US", { month: "long", year: "numeric" })}
          </strong>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonth(month.add({ months: 1 }))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="calendar-days" role="group" aria-label="Choose a date">
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <span key={index}>{day}</span>
          ))}
          {Array.from({ length: first.dayOfWeek - 1 }, (_, index) => (
            <i key={`space-${index}`} />
          ))}
          {Array.from({ length: month.daysInMonth }, (_, index) => {
            const date = month.toPlainDate({ day: index + 1 }).toString();
            return (
              <button
                type="button"
                key={date}
                aria-label={dateText(date)}
                aria-pressed={candidate === date}
                className={candidate === date ? "selected" : ""}
                onClick={() => setCandidate(date)}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
        <label className="editor-field-label" htmlFor="calendar-date">
          Selected date
        </label>
        <input
          id="calendar-date"
          className="editor-input"
          type="date"
          value={candidate}
          required
          onChange={(event) => {
            setCandidate(event.target.value);
            if (event.target.value)
              setMonth(
                Temporal.PlainYearMonth.from(event.target.value.slice(0, 7)),
              );
          }}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <DialogActions onCancel={onClose} />
      </form>
    </EditorDialog>
  );
}

function TimeEditor({ field, value, start, onConfirm, onClose, error }: Props) {
  const [candidate, setCandidate] = useState(value.split("T")[1] || "18:00");
  const initial = field.startsWith("end")
    ? start.split("T")[1] || "17:00"
    : candidate;
  const minutes =
    Number(initial.slice(0, 2)) * 60 + Number(initial.slice(3, 5));
  const options = Array.from({ length: 10 }, (_, index) => {
    const duration = field.startsWith("end")
      ? (index + 1) * 30
      : (index - 2) * 30;
    const total = minutes + duration;
    if (total < 0 || total >= 1440) return null;
    return {
      time: `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`,
      duration,
    };
  }).filter((option) => option !== null);
  return (
    <EditorDialog
      title={field.startsWith("start") ? "Start time" : "End time"}
      icon={<Clock3 size={24} />}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(candidate);
        }}
      >
        <label className="editor-field-label" htmlFor="editor-time">
          Choose a time
        </label>
        <input
          id="editor-time"
          autoFocus
          className="editor-input"
          type="time"
          value={candidate}
          onChange={(event) => setCandidate(event.target.value)}
          required
        />
        <div className="time-options">
          {options.map((option) => (
            <button
              key={option.time}
              type="button"
              aria-pressed={candidate === option.time}
              className={candidate === option.time ? "selected" : ""}
              onClick={() => setCandidate(option.time)}
            >
              <span>{timeText(option.time)}</span>
              {field.startsWith("end") && (
                <small>+{option.duration / 60}h from start time</small>
              )}
            </button>
          ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <DialogActions onCancel={onClose} />
      </form>
    </EditorDialog>
  );
}

function TimezoneEditor({ value, start, onConfirm, onClose, error }: Props) {
  const [query, setQuery] = useState("");
  const [candidate, setCandidate] = useState(value);
  const popular = [
    "Asia/Jakarta",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Asia/Kolkata",
    "Asia/Dubai",
    "Europe/London",
    "Europe/Paris",
    "America/New_York",
    "America/Chicago",
    "America/Los_Angeles",
    "Australia/Sydney",
    "UTC",
  ];
  const available = Array.from(
    new Set([...popular, ...Intl.supportedValuesOf("timeZone")]),
  );
  const filtered = available.filter((zone) =>
    zone.replaceAll("_", " ").toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <EditorDialog
      title="Event timezone"
      description="Your event keeps the same moment when you change its timezone."
      icon={<Globe2 size={24} />}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(candidate);
        }}
      >
        <label className="editor-search">
          <Search size={16} />
          <input
            autoFocus
            aria-label="Search timezones"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search city or timezone"
          />
        </label>
        <div className="timezone-options">
          {filtered.map((zone) => (
            <button
              type="button"
              key={zone}
              className={candidate === zone ? "selected" : ""}
              aria-pressed={candidate === zone}
              onClick={() => setCandidate(zone)}
            >
              <span>{zone.replaceAll("_", " ")}</span>
              <small>{zoneOffset(zone, start)}</small>
            </button>
          ))}
          {!filtered.length && <p>No matching timezone.</p>}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <DialogActions onCancel={onClose} />
      </form>
    </EditorDialog>
  );
}
