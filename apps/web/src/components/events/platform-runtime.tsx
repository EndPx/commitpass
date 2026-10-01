"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import {
  CalendarDays,
  Compass,
  LogOut,
  Plus,
  Settings,
  UserRound,
} from "lucide-react";
import { AuthProvider, authConfigured } from "@/components/auth/provider";
import { Brand } from "@/components/landing/brand";
import { AccountProvider, useAccount } from "./account-context";
import { ProfileSetup, ProfileWelcome } from "./profile-name";
import { WalletAddress } from "./wallet-address";
import { PageThemeProvider } from "./page-theme";
import { LocalRuntimeNotice } from "./local-runtime";
import { Faucet } from "./faucet";
import { PreferencesProvider, usePreferences } from "./preferences";
import { AccountSettings } from "./account-settings";
import { clockLabel } from "@/lib/display-time";
import { isLocal } from "@/lib/runtime-network";

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
        <PreferencesProvider>
          <PageThemeProvider>
            <Navigation />
            <GuestAccess>
              <LocalRuntimeNotice />
              {children}
            </GuestAccess>
            <footer className="workspace-footer">
              <Brand compact href="/" />
              <span>
                {isLocal
                  ? "Local Anvil · CRE simulation · Test funds only"
                  : "Monad testnet · Test funds only"}
              </span>
            </footer>
          </PageThemeProvider>
        </PreferencesProvider>
      </AccountProvider>
    </AuthProvider>
  );
}
function GuestAccess({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { session, connecting, error, refresh } = useAccount();
  const [welcomeName, setWelcomeName] = useState("");
  const publicPage =
    path === "/discover" || /^\/events\/0x[0-9a-fA-F]{40}$/.test(path);
  useEffect(() => {
    if (ready && !authenticated && !publicPage) router.replace("/discover");
  }, [ready, authenticated, publicPage, router]);
  if (!publicPage && (!ready || !authenticated))
    return (
      <main id="workspace-main" className="workspace-loading" role="status">
        Opening your workspace…
      </main>
    );
  if (authenticated && welcomeName)
    return (
      <ProfileWelcome
        name={welcomeName}
        onContinue={() => setWelcomeName("")}
      />
    );
  if (authenticated) {
    if (error)
      return (
        <main id="workspace-main" className="workspace-empty" role="alert">
          <h1>We couldn’t connect your profile.</h1>
          <p>{error}</p>
          <button className="button" onClick={refresh}>
            Try again
          </button>
        </main>
      );
    if (connecting || !session)
      return (
        <main id="workspace-main" className="workspace-loading" role="status">
          Loading your profile…
        </main>
      );
    if (!session.profileCompleted)
      return (
        <ProfileSetup
          onSaved={(profile) => setWelcomeName(profile.name ?? "")}
        />
      );
  }
  return children;
}
function Navigation() {
  const path = usePathname();
  const eventPage = /^\/events\/0x[0-9a-fA-F]{40}(?:\/manage)?$/.test(path);
  const { ready, authenticated, user, logout } = usePrivy();
  const { session } = useAccount();
  const { timezone } = usePreferences();
  const [settingsOpen, setSettingsOpen] = useState(false);
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
        label: clockLabel(now, timezone),
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
  }, [timezone]);
  const name =
    session?.profileCompleted && session.name ? session.name : "Your account";
  return (
    <>
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      <header
        className={`workspace-header${eventPage ? " workspace-header--event" : ""}${scrolled ? " is-scrolled" : ""}`}
      >
        <Brand href="/" markOnly />
        <nav aria-label="App navigation">
          {ready && authenticated && (
            <Link
              className={path.startsWith("/events") ? "active" : ""}
              aria-current={path.startsWith("/events") ? "page" : undefined}
              href="/events"
            >
              <CalendarDays size={17} />
              <span>Events</span>
            </Link>
          )}
          <Link
            className={path === "/discover" ? "active" : ""}
            aria-current={path === "/discover" ? "page" : undefined}
            href="/discover"
          >
            <Compass size={17} />
            <span>Discover</span>
          </Link>
        </nav>
        <div className="workspace-header-actions">
          {ready && authenticated && <Faucet />}
          {ready && authenticated && clock && (
            <time
              className="workspace-clock"
              dateTime={clock.datetime}
              title={timezone.replaceAll("_", " ")}
            >
              {clock.label}
            </time>
          )}
          {ready && authenticated && (
            <Link
              className="workspace-create-link"
              href="/events/new"
              aria-label="Create event"
            >
              <Plus size={16} />
              <span>Create event</span>
            </Link>
          )}
          {ready && authenticated ? (
            <details className="account-menu">
              <summary aria-label="Your account">
                <span>{name[0]?.toUpperCase() || <UserRound size={16} />}</span>
              </summary>
              <div className="account-popover">
                <strong>{name}</strong>
                <p>
                  {user?.email?.address ||
                    user?.google?.email ||
                    "Signed in with Privy"}
                </p>
                <WalletAddress />
                <Link
                  href="/profile"
                  className="account-profile-link"
                  onClick={(event) =>
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open")
                  }
                >
                  <UserRound size={15} /> My profile
                </Link>
                <button
                  type="button"
                  className="account-settings-trigger"
                  onClick={(event) => {
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                    setSettingsOpen(true);
                  }}
                >
                  <Settings size={15} /> Settings
                </button>
                <button
                  className="account-sign-out"
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
      {settingsOpen && authenticated && (
        <AccountSettings onClose={() => setSettingsOpen(false)} />
      )}
    </>
  );
}
