import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a
      className={`brand${compact ? " brand--compact" : ""}`}
      href="#top"
      aria-label="CommitPass home"
    >
      <Image
        className="brand-mark"
        src="/brand/commitpass-mark.png"
        alt=""
        width={44}
        height={44}
        sizes="44px"
        priority={!compact}
      />
      <span>
        commitpass<span className="brand-period">.</span>
      </span>
    </a>
  );
}
