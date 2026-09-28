export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a
      className={`brand${compact ? " brand--compact" : ""}`}
      href="#top"
      aria-label="CommitPass home"
    >
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M9 7h23v9a5 5 0 0 0 0 10v9H9v-9a5 5 0 0 0 0-10z"
          fill="currentColor"
          transform="rotate(12 20 20)"
        />
        <path
          d="m14 20 5 5 9-11"
          stroke="var(--canvas)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        commitpass<span className="brand-period">.</span>
      </span>
    </a>
  );
}
