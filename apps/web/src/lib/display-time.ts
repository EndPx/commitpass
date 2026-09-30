export function utcOffset(date: Date, timezone: string) {
  const offset = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = offset?.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  return match
    ? `UTC${match[1]}${match[2]!.padStart(2, "0")}:${match[3] ?? "00"}`
    : "UTC+00:00";
}
export function displayTime(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
export function clockLabel(date: Date, timezone: string) {
  return `${displayTime(date, timezone)} ${utcOffset(date, timezone)}`;
}
