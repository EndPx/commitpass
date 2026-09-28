"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { CalendarDays, Compass, LogOut, Plus, UserRound } from "lucide-react";
import { AuthProvider, authConfigured } from "@/components/auth/provider";
import { Brand } from "@/components/landing/brand";
import { AccountProvider } from "./account-context";

export default function PlatformRuntime({ children }: { children: ReactNode }) {
  if (!authConfigured)
    return (
      <div className="workspace-empty">
        <h1>We’ll be right back.</h1>
        <p>Account services are temporarily unavailable.</p>
        <Link href="/">Back home</Link>
      </div>
    );
  return (
    <AuthProvider>
      <AccountProvider>
        <Navigation />
        {children}
        <footer className="workspace-footer">
          <Brand compact href="/" />
          <span>Monad testnet · Test funds only</span>
        </footer>
      </AccountProvider>
    </AuthProvider>
  );
}
function Navigation() {
  const path = usePathname();
  const { ready, authenticated, user, logout } = usePrivy();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [clock, setClock] = useState<{
    label: string;
    datetime: string;
  } | null>(null);
  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 8);
    const updateClock = () => {
      const now = new Date();
      setClock({
        label: new Intl.DateTimeFormat("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
        }).format(now),
        datetime: now.toISOString(),
      });
    };
    updateScroll();
    updateClock();
    window.addEventListener("scroll", updateScroll, { passive: true });
    const timer = window.setInterval(updateClock, 30000);
    return () => {
      window.removeEventListener("scroll", updateScroll);
      window.clearInterval(timer);
    };
  }, []);
  const name = user?.google?.name || user?.email?.address || "Your account";
  return (
    <>
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      <header className={`workspace-header${scrolled ? " is-scrolled" : ""}`}>
        <Brand href="/" markOnly />
        <nav aria-label="App navigation">
          <Link
            className={path.startsWith("/events") ? "active" : ""}
            href="/events"
          >
            <CalendarDays size={17} />
            <span>Events</span>
          </Link>
          <Link
            className={path === "/discover" ? "active" : ""}
            href="/discover"
          >
            <Compass size={17} />
            <span>Discover</span>
          </Link>
        </nav>
        <div className="workspace-header-actions">
          {clock && (
            <time className="workspace-clock" dateTime={clock.datetime}>
              {clock.label}
            </time>
          )}
          <Link
            className="workspace-create-link"
            href="/events/new"
            aria-label="Create event"
          >
            <Plus size={16} />
            <span>Create event</span>
          </Link>
          {ready && authenticated ? (
            <details className="account-menu">
              <summary aria-label="Your account">
                <span>{name[0]?.toUpperCase() || <UserRound size={16} />}</span>
              </summary>
              <div className="account-popover">
                <strong>{user?.google?.name || "Your account"}</strong>
                <p>
                  {user?.email?.address ||
                    user?.google?.email ||
                    "Signed in with Privy"}
                </p>
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await logout();
                    } catch {
                      setError("Could not sign out. Try again.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <LogOut size={15} />
                  {busy ? "Signing out…" : "Sign out"}
                </button>
                {error && <p role="alert">{error}</p>}
              </div>
            </details>
          ) : (
            <Link
              className="button button--small"
              href={`/signin?next=${encodeURIComponent(path)}`}
            >
              Sign in
            </Link>
          )}
        </div>
      </header>
    </>
  );
}
