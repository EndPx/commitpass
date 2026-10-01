"use client";
export function EventPeriodTabs({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="segmented event-period-tabs" aria-label="Event dates">
      {["upcoming", "past"].map((period) => (
        <button
          key={period}
          aria-pressed={value === period}
          className={value === period ? "selected" : ""}
          onClick={() => onChange(period)}
        >
          {period === "upcoming" ? "Upcoming" : "Past"}
        </button>
      ))}
    </div>
  );
}
