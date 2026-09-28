export function EventCover({
  title,
  posterUrl,
  small = false,
}: {
  title: string;
  posterUrl?: string;
  small?: boolean;
}) {
  const safeImage = posterUrl && /^https:\/\//i.test(posterUrl);
  return (
    <div className={`event-cover${small ? " event-cover--small" : ""}`}>
      {safeImage ? (
        <img
          src={posterUrl}
          alt="Event cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="event-cover-art" aria-hidden="true">
          <span>GOOD PEOPLE. GOOD PLANS.</span>
          <svg viewBox="0 0 200 200" fill="none">
            <path
              d="M100 10v180M10 100h180M36 36l128 128M36 164 164 36"
              stroke="currentColor"
              strokeWidth="18"
            />
            <circle cx="100" cy="100" r="34" fill="var(--cover-paper)" />
          </svg>
          <strong>{title || "Your next\ngood idea."}</strong>
          <span>LET’S SHOW UP.</span>
        </div>
      )}
    </div>
  );
}
