"use client";

import { ArrowUpRight, MapPin, Video } from "lucide-react";

function locationTarget(value: string) {
  const text = value.trim();
  if (!text) return null;
  const looksLikeUrl =
    /^(https?:\/\/|www\.)/i.test(text) || /^[\w.-]+\.[a-z]{2,}\//i.test(text);
  if (!looksLikeUrl) return { address: text, href: "", maps: true };
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    const maps =
      (/(^|\.)google\.[a-z.]+$/.test(url.hostname) &&
        (url.pathname.startsWith("/maps") ||
          url.hostname.startsWith("maps."))) ||
      url.hostname === "maps.app.goo.gl";
    const place = maps
      ? url.searchParams.get("q") ||
        url.searchParams.get("query") ||
        url.pathname.match(/\/place\/([^/]+)/)?.[1]
      : null;
    return {
      address: place ? decodeURIComponent(place).replaceAll("+", " ") : "",
      href: url.href,
      maps,
    };
  } catch {
    return { address: text, href: "", maps: true };
  }
}

export function EventLocation({
  location,
  compact = false,
}: {
  location: string;
  compact?: boolean;
}) {
  const target = locationTarget(location);
  if (!target) return null;
  if (!target.address)
    return (
      <section
        className={`event-venue${compact ? " event-venue--compact" : ""}`}
        aria-label={target.maps ? "Event location" : "Virtual event"}
      >
        {!compact && <h2>{target.maps ? "Location" : "Join online"}</h2>}
        <a
          className="event-venue-link"
          href={target.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {target.maps ? <MapPin size={18} /> : <Video size={18} />}
          <span>
            {target.maps ? "Open location in Maps" : "Open event link"}
            <small>{location}</small>
          </span>
          <ArrowUpRight size={16} />
        </a>
        {compact && target.maps && (
          <p className="editor-help">
            Use a venue name and full address to show a map preview here.
          </p>
        )}
      </section>
    );
  const query = encodeURIComponent(target.address);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY;
  const src = key
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${query}`
    : `https://maps.google.com/maps?q=${query}&output=embed`;
  return (
    <section
      className={`event-venue${compact ? " event-venue--compact" : ""}`}
      aria-label="Event location"
    >
      {!compact && (
        <>
          <h2>Location</h2>
          <p className="event-venue-address">{target.address}</p>
        </>
      )}
      <div className="event-venue-map">
        <iframe
          key={src}
          src={src}
          title={`Map of ${target.address}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
      <a
        className="event-venue-directions"
        href={`https://www.google.com/maps/search/?api=1&query=${query}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open in Google Maps <ArrowUpRight size={14} />
      </a>
      {compact && (
        <p className="editor-help">
          Check that the map matches your venue. Add the city and full address
          for a more precise result.
        </p>
      )}
    </section>
  );
}
