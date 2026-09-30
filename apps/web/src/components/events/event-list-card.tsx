"use client";
import Link from "next/link";
import { MapPin, Users, Video } from "lucide-react";
import type { EventSummary } from "@commitpass/shared";
import {
  amount,
  dateLabel,
  eventTitle,
  shorten,
  statusLabel,
  timeLabel,
} from "@/lib/events";
import { EventCover } from "./event-cover";
import { usePreferences } from "./preferences";
import { utcOffset } from "@/lib/display-time";

export function eventFormat(event: EventSummary) {
  const location = event.metadata?.location.trim() ?? "";
  if (!location) return "unknown";
  const link =
    /^(https?:\/\/|www\.)/i.test(location) ||
    /^[\w.-]+\.[a-z]{2,}\//i.test(location);
  const maps =
    /(?:maps\.app\.goo\.gl|google\.[^/]+\/maps|maps\.google\.)/i.test(location);
  return link && !maps ? "online" : "in-person";
}

export function hasOpenSpots(event: EventSummary, now: number) {
  return (
    !event.registrationClosed &&
    Number(event.registrationDeadline) * 1000 > now &&
    ![
      "ACTIVE",
      "START_REQUESTED",
      "SETTLEMENT_REQUESTED",
      "SETTLED",
      "REFUNDED",
      "CANCELLED",
    ].includes(event.status) &&
    BigInt(event.participantCount) < BigInt(event.maxParticipant)
  );
}

export function EventListCard({
  event,
  personal = false,
  hosting = false,
}: {
  event: EventSummary;
  personal?: boolean;
  hosting?: boolean;
}) {
  const { timezone } = usePreferences();
  const title = eventTitle(event);
  const online = eventFormat(event) === "online";
  const finalized = ["SETTLED", "REFUNDED", "CANCELLED"].includes(event.status);
  const badge = finalized
    ? statusLabel(event)
    : hosting
      ? "Hosting"
      : "Spot reserved";
  const guests = event.participantCount;
  const remaining = BigInt(event.maxParticipant) - BigInt(guests);
  const availability =
    remaining <= 0n
      ? "Full"
      : hasOpenSpots(event, Date.now())
        ? `${remaining} ${remaining === 1n ? "spot" : "spots"} left`
        : statusLabel(event);
  const start = new Date(Number(event.startAt) * 1000);
  const status =
    event.status === "ACTIVE"
      ? "live"
      : event.status === "CANCELLED"
        ? "cancelled"
        : "";
  return (
    <Link
      className={personal ? "plan-card" : "discover-card"}
      href={`/events/${event.vault}`}
    >
      {!personal && (
        <div className="discover-card-poster">
          <EventCover title={title} posterUrl={event.metadata?.posterUrl} />
          <div className="discover-date">
            <strong>
              {dateLabel(event.startAt, {
                month: "short",
                day: "numeric",
                timeZone: timezone,
              })}
            </strong>
            <span>
              {dateLabel(event.startAt, {
                weekday: "short",
                timeZone: timezone,
              })}
            </span>
          </div>
        </div>
      )}
      <div className="plan-card-info">
        <div className="plan-time">
          {status === "live" && (
            <span className="plan-live">
              <i /> Live
            </span>
          )}
          <time
            dateTime={
              Number.isFinite(start.getTime()) ? start.toISOString() : undefined
            }
          >
            {timeLabel(event.startAt, timezone)}{" "}
            <small>{utcOffset(start, timezone)}</small>
          </time>
        </div>
        <h2>{title}</h2>
        <p className="plan-host">
          <span className="host-avatar" aria-hidden="true">
            {hosting ? "Y" : event.organizer.slice(2, 3).toUpperCase()}
          </span>
          {hosting ? "Hosted by you" : `By ${shorten(event.organizer)}`}
        </p>
        <p className="plan-location">
          {online ? <Video size={15} /> : <MapPin size={15} />}
          <span>
            {online
              ? "Online event"
              : event.metadata?.location || "Location to be announced"}
          </span>
        </p>
        <div className="plan-card-bottom">
          {personal ? (
            <span
              className={`plan-badge ${hosting && !finalized ? "plan-badge--host" : ""} ${finalized ? "plan-badge--quiet" : ""}`}
            >
              {badge}
            </span>
          ) : (
            <span className="discover-commitment">
              {amount(event.stakeAmount)} USDC <span>refundable</span>
            </span>
          )}
          <span className="plan-guests">
            <Users size={14} />{" "}
            {personal
              ? `${guests} ${guests === 1 ? "guest" : "guests"}`
              : availability}
          </span>
        </div>
        {event.metadataUnavailable && (
          <small className="plan-detail-warning">
            Some event details are temporarily unavailable.
          </small>
        )}
      </div>
      {personal && (
        <EventCover small title={title} posterUrl={event.metadata?.posterUrl} />
      )}
    </Link>
  );
}
