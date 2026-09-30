import { Temporal } from "@js-temporal/polyfill";
import {
  DEFAULT_EVENT_APPEARANCE,
  type EventAppearance,
  type EventMetadata,
} from "@commitpass/shared";
import brandMedia from "./brand-media.json";

export const coverTemplates = brandMedia.templates;
export const defaultCover = coverTemplates[0]!.url;
const coverAppearances: Record<string, EventAppearance[]> = {
  together: [
    { style: "confetti", color: "#e9792e", font: "sans", mode: "light" },
    { style: "grid", color: "#246b55", font: "mono", mode: "dark" },
  ],
  "good-plans": [
    { style: "grid", color: "#385fd1", font: "mono", mode: "light" },
    { style: "aurora", color: "#7951b0", font: "serif", mode: "dark" },
  ],
  workshop: [
    { style: "minimal", color: "#b9462d", font: "serif", mode: "light" },
    { style: "aurora", color: "#246b55", font: "sans", mode: "dark" },
  ],
};
export type EventDraft = EventMetadata & {
  start: string;
  end: string;
  deadline: string;
  deadlineFollowsStart: boolean;
  commitment: string;
  capacity: string;
  timezone: string;
  appearance: EventAppearance;
};
export function shuffleEventLook(draft: EventDraft): EventDraft {
  const options = coverTemplates
    .filter((cover) => cover.url !== draft.posterUrl)
    .flatMap((cover) =>
      (coverAppearances[cover.id] ?? [DEFAULT_EVENT_APPEARANCE])
        .filter((appearance) => appearance.style !== draft.appearance.style)
        .map((appearance) => ({ posterUrl: cover.url, appearance })),
    );
  const next = options[Math.floor(Math.random() * options.length)];
  return next
    ? {
        ...draft,
        posterUrl: next.posterUrl,
        appearance: { ...next.appearance },
      }
    : draft;
}
export function browserZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
export function validZone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
export function normalizeAppearance(
  value?: Partial<EventAppearance> | null,
): EventAppearance {
  return {
    style: ["minimal", "aurora", "confetti", "grid"].includes(
      value?.style ?? "",
    )
      ? value!.style!
      : "minimal",
    color: /^#[0-9a-f]{6}$/i.test(value?.color ?? "")
      ? value!.color!
      : DEFAULT_EVENT_APPEARANCE.color,
    font: ["sans", "serif", "mono"].includes(value?.font ?? "")
      ? value!.font!
      : "sans",
    mode: value?.mode === "dark" ? "dark" : "light",
  };
}
export function wallTime(value: string, zone: string) {
  try {
    return Temporal.PlainDateTime.from(value).toZonedDateTime(zone, {
      disambiguation: "reject",
    });
  } catch {
    throw new Error(
      "Choose a valid date and time in this timezone. Times repeated or skipped by daylight saving are not supported.",
    );
  }
}
export const eventTimestamp = (value: string, zone: string) =>
  Math.floor(wallTime(value, zone).epochMilliseconds / 1000);
export function registrationCutoff(value: string, start: string, zone: string) {
  const deadline = eventTimestamp(value, zone);
  const startAt = eventTimestamp(start, zone);
  // The deployed factory requires registrationDeadline < eventDate.
  return deadline === startAt ? startAt - 1 : deadline;
}
export function convertZone(value: string, from: string, to: string) {
  return wallTime(value, from)
    .withTimeZone(to)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}
export function zoneOffset(zone: string, value?: string) {
  try {
    const offset = (
      value ? wallTime(value, zone) : Temporal.Now.zonedDateTimeISO(zone)
    ).offset;
    return `GMT${offset}`;
  } catch {
    return zone;
  }
}
export function dateText(value: string) {
  try {
    return Temporal.PlainDate.from(value.split("T")[0]!).toLocaleString(
      "en-US",
      { weekday: "short", month: "short", day: "numeric" },
    );
  } catch {
    return "Choose date";
  }
}
export function timeText(value: string) {
  try {
    return Temporal.PlainTime.from(
      value.includes("T") ? value.split("T")[1]! : value,
    ).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "Choose time";
  }
}
export function freshDraft(): EventDraft {
  const timezone = browserZone();
  const start = Temporal.Instant.fromEpochMilliseconds(
    Math.ceil((Date.now() + 3600000) / 900000) * 900000,
  ).toZonedDateTimeISO(timezone);
  const format = (date: Temporal.ZonedDateTime) =>
    date.toPlainDateTime().toString({ smallestUnit: "minute" });
  return {
    title: "",
    description: "",
    location: "",
    posterUrl: defaultCover,
    start: format(start),
    end: format(start.add({ hours: 1 })),
    deadline: format(start.subtract({ minutes: 15 })),
    deadlineFollowsStart: false,
    commitment: "5",
    capacity: "30",
    timezone,
    appearance: { ...DEFAULT_EVENT_APPEARANCE },
  };
}
export function restoreDraft(value: unknown): EventDraft {
  if (!value || typeof value !== "object") return freshDraft();
  const record = value as Record<string, unknown>;
  const base = freshDraft();
  for (const key of [
    "title",
    "description",
    "location",
    "posterUrl",
    "start",
    "end",
    "deadline",
    "commitment",
    "capacity",
  ] as const) {
    if (typeof record[key] === "string") base[key] = record[key];
  }
  base.posterUrl ||= defaultCover;
  if (typeof record.timezone === "string" && validZone(record.timezone))
    base.timezone = record.timezone;
  base.appearance = normalizeAppearance(
    record.appearance as Partial<EventAppearance>,
  );
  base.deadlineFollowsStart =
    record.deadlineFollowsStart === true ||
    (record.deadlineFollowsStart === undefined && base.deadline === base.start);
  if (base.deadlineFollowsStart) base.deadline = base.start;
  return base;
}
