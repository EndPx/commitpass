import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Ticket } from "lucide-react";
export function EmptyEvents({
  title,
  description,
  href,
  action,
  icon,
  onAction,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
  icon?: ReactNode;
  onAction?: () => void;
}) {
  return (
    <div className="workspace-empty plans-empty">
      <div className="plans-empty-icon" aria-hidden="true">
        {icon ?? <Ticket size={30} strokeWidth={1.4} />}
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {onAction ? (
        <button className="button" onClick={onAction}>
          {action}
          <ArrowRight size={16} />
        </button>
      ) : (
        <Link className="button" href={href}>
          {action}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function LoadError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="workspace-error" role="alert">
      <h2>We couldn’t load that.</h2>
      <p>{message}</p>
      <button className="button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
