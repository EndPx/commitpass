"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { usePrivy } from "@privy-io/react-auth";
import { CalendarPlus, Check, Download, Ticket } from "lucide-react";
import type { EventSummary } from "@commitpass/shared";
import { dateLabel, eventTitle, jsonRequest, shorten } from "@/lib/events";

export function EventPass({
  event,
  wallet,
  claimed,
  attended,
  settled,
  refund = false,
}: {
  event: EventSummary;
  wallet: string;
  claimed: boolean;
  attended: boolean;
  settled: boolean;
  refund?: boolean;
}) {
  const { getAccessToken } = usePrivy();
  const [qr, setQr] = useState("");
  const [qrError, setQrError] = useState(false);
  const [attendance, setAttendance] = useState<boolean | null>(null);
  const [attendanceError, setAttendanceError] = useState(false);
  useEffect(() => {
    let active = true;
    setQr("");
    setQrError(false);
    const link = `${window.location.origin}/events/${event.vault}/manage?guest=${wallet}`;
    void QRCode.toDataURL(link, {
      width: 256,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#252622", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => {
        if (active) setQrError(true);
      });
    return () => {
      active = false;
    };
  }, [event.vault, wallet]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setAttendance(null);
    async function read() {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error();
        const result = await jsonRequest<{ checkedIn: boolean }>(
          `/api/events/${event.vault}/attendance/${wallet}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (active) {
          setAttendance(result.checkedIn);
          setAttendanceError(false);
        }
      } catch {
        if (active) setAttendanceError(true);
      } finally {
        if (active) timer = setTimeout(read, 15000);
      }
    }
    void read();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [event.vault, wallet, getAccessToken]);
  const status = claimed
    ? "Return claimed"
    : refund
      ? "Refund available"
      : settled
        ? attended
          ? "Attendance confirmed"
          : "Not marked as attended"
        : attendanceError
          ? "Check-in status unavailable"
          : attendance === null
            ? "Loading check-in status…"
            : attendance
              ? "Checked in"
              : "You’re on the guest list";
  function calendar() {
    const escape = (value: string) =>
      value
        .replaceAll("\\", "\\\\")
        .replaceAll("\n", "\\n")
        .replaceAll(",", "\\,")
        .replaceAll(";", "\\;")
        .replaceAll("\r", "");
    const stamp = (seconds: number) =>
      new Date(seconds * 1000)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    const text = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CommitPass//Event Pass//EN",
      "BEGIN:VEVENT",
      `UID:${event.chainId}-${event.vault}@commitpass`,
      `DTSTAMP:${stamp(Date.now() / 1000)}`,
      `DTSTART:${stamp(Number(event.startAt))}`,
      `DTEND:${stamp(Number(event.settleAt || Number(event.startAt) + 3600))}`,
      `SUMMARY:${escape(eventTitle(event))}`,
      `LOCATION:${escape(event.metadata?.location || "")}`,
      `DESCRIPTION:${escape("Show your CommitPass to your host for check-in.")}`,
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/calendar;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "commitpass-event.ics";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="event-pass" aria-label="Your event pass">
      <div className="event-pass-header">
        <Ticket size={20} />
        <strong>Your event pass</strong>
        <span>
          <Check size={13} /> {settled ? "Completed" : "Reserved"}
        </span>
      </div>
      <div className="event-pass-body">
        <div className="event-pass-info">
          <h3>{eventTitle(event)}</h3>
          <p>
            {dateLabel(event.startAt, {
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZone: event.metadata?.timezone,
            })}
          </p>
          <p className="event-pass-status" role="status">
            {status}
          </p>
          <small>
            {settled
              ? "Keep this pass as your reservation record."
              : "Show this pass to your host when you arrive."}
          </small>
          <span className="event-pass-wallet" title={wallet}>
            {shorten(wallet)}
          </span>
        </div>
        <div className="event-pass-qr">
          {qr ? (
            <img
              src={qr}
              alt="Event pass QR code for the host to find your reservation"
              width={144}
              height={144}
            />
          ) : (
            <span>
              {qrError
                ? "QR unavailable. Show your wallet below."
                : "Preparing your pass…"}
            </span>
          )}
        </div>
      </div>
      <div className="event-pass-actions">
        <button type="button" onClick={calendar}>
          <CalendarPlus size={15} /> Add to calendar
        </button>
        {qr && (
          <a href={qr} download="commitpass-pass.png">
            <Download size={15} /> Save pass
          </a>
        )}
      </div>
    </section>
  );
}
