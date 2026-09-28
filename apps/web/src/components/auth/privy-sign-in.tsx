"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Captcha,
  PrivyProvider,
  useLoginWithEmail,
  useLoginWithOAuth,
  useLoginWithPasskey,
  usePrivy,
} from "@privy-io/react-auth";
import { monadTestnetChain } from "@commitpass/shared";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Fingerprint,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  Mail,
} from "lucide-react";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const googleEnabled = process.env.NEXT_PUBLIC_PRIVY_GOOGLE_ENABLED === "true";
const passkeyEnabled = process.env.NEXT_PUBLIC_PRIVY_PASSKEY_ENABLED === "true";

export default function PrivySignIn() {
  if (!appId) {
    return (
      <section className="auth-card">
        <div className="auth-card-body">
          <span className="auth-symbol">
            <LogIn size={28} />
          </span>
          <h1>We’ll be right back.</h1>
          <p className="auth-description">
            Sign-in is temporarily unavailable. Please try again later.
          </p>
          <Link className="auth-submit" href="/">
            Back to CommitPass <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "light",
          accentColor: "#b9462d",
          logo: "/brand/commitpass-mark.png",
          walletChainType: "ethereum-only",
        },
        loginMethods: googleEnabled ? ["email", "google"] : ["email"],
        defaultChain: monadTestnetChain,
        supportedChains: [monadTestnetChain],
      }}
    >
      <SignInForm />
    </PrivyProvider>
  );
}

function SignInForm() {
  const { ready, authenticated, user, getAccessToken, logout } = usePrivy();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sessionStatus, setSessionStatus] = useState<
    "connecting" | "connected" | "error"
  >("connecting");
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [canUsePasskey, setCanUsePasskey] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { initOAuth, state: oauthState } = useLoginWithOAuth({
    onError: () =>
      setError(
        "Google sign-in wasn’t completed. Please try again or use email.",
      ),
  });
  const { loginWithPasskey } = useLoginWithPasskey();

  useEffect(() => {
    setCanUsePasskey(
      window.isSecureContext &&
        typeof window.PublicKeyCredential !== "undefined",
    );
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown((remaining) => Math.max(0, remaining - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (sentTo) codeInput.current?.focus();
  }, [sentTo]);

  useEffect(() => {
    if (!ready || !authenticated || !user?.id) return;
    const controller = new AbortController();
    const userId = user.id;
    setSessionStatus("connecting");
    async function connectSession() {
      try {
        const token = await getAccessToken();
        if (!token || controller.signal.aborted)
          throw new Error("Session unavailable");
        const response = await fetch("/api/session", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Session unavailable");
        const session: { id?: string } = await response.json();
        if (session.id !== userId) throw new Error("Session mismatch");
        if (!controller.signal.aborted) setSessionStatus("connected");
      } catch {
        if (!controller.signal.aborted) setSessionStatus("error");
      }
    }
    void connectSession();
    return () => controller.abort();
  }, [ready, authenticated, user?.id, getAccessToken, sessionAttempt]);

  const busy = pending || oauthState.status === "loading";

  async function sendEmailCode() {
    if (pending || cooldown > 0) return;
    const address = sentTo || email.trim();
    setPending(true);
    setError("");
    try {
      await sendCode({ email: address });
      setSentTo(address);
      setCode("");
      setCooldown(30);
    } catch {
      setError(
        "We couldn’t send your code. Check your email address and try again in a moment.",
      );
    } finally {
      setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    if (!sentTo) return sendEmailCode();
    setPending(true);
    setError("");
    try {
      await loginWithCode({ code });
      setCode("");
    } catch {
      setError(
        "That code couldn’t be verified. Try again, or request a new code.",
      );
      codeInput.current?.focus();
    } finally {
      setPending(false);
    }
  }

  async function signInWithGoogle() {
    if (!ready || busy) return;
    setPending(true);
    setError("");
    try {
      await initOAuth({ provider: "google" });
    } catch {
      setError(
        "Google sign-in wasn’t completed. Please try again or use email.",
      );
    } finally {
      setPending(false);
    }
  }

  async function signInWithPasskey() {
    if (!ready || busy) return;
    setPending(true);
    setError("");
    try {
      await loginWithPasskey();
    } catch {
      setError("No passkey was used. Try again, or sign in with email.");
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    setPending(true);
    setError("");
    try {
      await logout();
      setSentTo("");
      setEmail("");
      setCode("");
      setCooldown(0);
      setSessionStatus("connecting");
    } catch {
      setError("We couldn’t sign you out. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (ready && authenticated) {
    return (
      <section className="auth-card" aria-labelledby="signin-title">
        <div className="auth-card-body">
          <span
            className={`auth-symbol${sessionStatus === "connected" ? " auth-symbol--success" : ""}`}
          >
            {sessionStatus === "connected" ? (
              <Check size={28} />
            ) : sessionStatus === "connecting" ? (
              <LoaderCircle size={26} className="auth-spinner" />
            ) : (
              <LogIn size={28} />
            )}
          </span>
          <h1 id="signin-title">
            {sessionStatus === "connected"
              ? "You’re in."
              : sessionStatus === "connecting"
                ? "One moment…"
                : "Let’s try that again."}
          </h1>
          <p className="auth-description" role="status">
            {sessionStatus === "connected"
              ? "Your CommitPass account is ready. Good plans start with showing up."
              : sessionStatus === "connecting"
                ? "Connecting your account to CommitPass."
                : "You’re signed in, but we couldn’t connect your account right now."}
          </p>
          {sessionStatus === "connected" && (
            <>
              <div className="auth-account">
                <Check size={16} />
                <span>
                  {user?.email?.address ||
                    user?.google?.email ||
                    "Signed in securely"}
                </span>
              </div>
              <Link href="/" className="auth-submit">
                Back to CommitPass <ArrowRight size={16} />
              </Link>
            </>
          )}
          {sessionStatus === "error" && (
            <button
              type="button"
              className="auth-submit"
              onClick={() => setSessionAttempt((attempt) => attempt + 1)}
            >
              Try again <ArrowRight size={16} />
            </button>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="auth-text-button auth-signout"
            disabled={pending}
            onClick={signOut}
          >
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-card" aria-labelledby="signin-title">
      <div className="auth-card-body">
        <span className="auth-symbol">
          {sentTo ? (
            <Mail size={28} strokeWidth={1.5} />
          ) : (
            <LogIn size={28} strokeWidth={1.5} />
          )}
        </span>
        <h1 id="signin-title">
          {sentTo ? "Check your inbox" : "Welcome to CommitPass"}
        </h1>
        <p className="auth-description">
          {sentTo ? (
            <>
              Enter the 6-digit code sent to <strong>{sentTo}</strong>.
            </>
          ) : (
            "Sign in or create an account below."
          )}
        </p>
        <form className="auth-form" onSubmit={submit} aria-busy={busy}>
          <div className="auth-label-row">
            <label htmlFor={sentTo ? "signin-code" : "signin-email"}>
              {sentTo ? "Verification code" : "Email"}
            </label>
            {sentTo && (
              <button
                className="auth-text-button"
                type="button"
                disabled={busy}
                onClick={() => {
                  setSentTo("");
                  setCode("");
                  setError("");
                  setCooldown(0);
                  requestAnimationFrame(() => emailInput.current?.focus());
                }}
              >
                Change email
              </button>
            )}
          </div>
          {sentTo ? (
            <input
              ref={codeInput}
              id="signin-code"
              className="auth-input auth-code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              disabled={busy}
              aria-describedby={error ? "signin-error" : undefined}
              aria-invalid={Boolean(error)}
            />
          ) : (
            <input
              ref={emailInput}
              id="signin-email"
              className="auth-input"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@email.com"
              maxLength={254}
              required
              disabled={busy}
              aria-describedby={error ? "signin-error" : undefined}
              aria-invalid={Boolean(error)}
            />
          )}
          {error && (
            <p id="signin-error" className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="auth-submit"
            type="submit"
            disabled={!ready || busy || (Boolean(sentTo) && code.length !== 6)}
          >
            {busy ? (
              <>
                <LoaderCircle className="auth-spinner" size={16} />{" "}
                {sentTo ? "Please wait…" : "Sending code…"}
              </>
            ) : !ready ? (
              "Getting ready…"
            ) : sentTo ? (
              <>
                Verify & continue <ArrowRight size={16} />
              </>
            ) : (
              "Continue with email"
            )}
          </button>
        </form>
        {sentTo && (
          <div className="auth-resend">
            <span>Didn’t get the email?</span>
            <button
              className="auth-text-button"
              type="button"
              disabled={cooldown > 0 || busy}
              onClick={sendEmailCode}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
            <button
              className="auth-back-button"
              type="button"
              disabled={busy}
              onClick={() => {
                setSentTo("");
                setCode("");
                setError("");
                setCooldown(0);
              }}
            >
              <ArrowLeft size={14} /> Back to sign in
            </button>
          </div>
        )}
      </div>
      {!sentTo && (
        <div className="auth-card-bottom">
          {googleEnabled && (
            <button
              type="button"
              className="auth-provider-button"
              onClick={signInWithGoogle}
              disabled={!ready || busy}
            >
              <GoogleMark /> Continue with Google
            </button>
          )}
          {passkeyEnabled && canUsePasskey && (
            <button
              type="button"
              className="auth-provider-button"
              onClick={signInWithPasskey}
              disabled={!ready || busy}
            >
              <Fingerprint size={19} /> Sign in with passkey
            </button>
          )}
          <p className="auth-trust">
            <LockKeyhole size={13} /> Secure sign-in, powered by Privy
          </p>
        </div>
      )}
      <Captcha />
    </section>
  );
}

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36ZM12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.75-5.58-4.1H3.07v2.59A10 10 0 0 0 12 22ZM6.42 13.94a6 6 0 0 1 0-3.88V7.47H3.07a10 10 0 0 0 0 9.06l3.35-2.59ZM12 5.96c1.47 0 2.79.51 3.82 1.5l2.86-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.47l3.35 2.59C7.2 7.71 9.4 5.96 12 5.96Z"
      />
    </svg>
  );
}
