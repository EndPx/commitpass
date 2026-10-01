"use client";
import { useState, type FormEvent } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { ArrowRight, UserRound } from "lucide-react";
import { jsonRequest } from "@/lib/events";
import { useAccount, type Session } from "./account-context";

export function ProfileNameForm({
  initialName = "",
  onSaved,
}: {
  initialName?: string;
  onSaved: (session: Session) => void;
}) {
  const { getAccessToken } = usePrivy();
  const { updateSession } = useAccount();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Please sign in again.");
      const result = await jsonRequest<Session>("/api/profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!result.id || !result.name || !result.profileCompleted)
        throw new Error("Your profile could not be saved.");
      onSaved(result);
      updateSession(result);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "We couldn’t save your name. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="profile-name-form" onSubmit={save}>
      <label htmlFor="profile-display-name">Your name</label>
      <input
        id="profile-display-name"
        name="name"
        autoComplete="nickname"
        autoFocus
        required
        minLength={2}
        maxLength={60}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="What should we call you?"
        aria-describedby="profile-name-help"
        disabled={busy}
      />
      <p id="profile-name-help">This is how you’ll appear on CommitPass.</p>
      {error && (
        <p className="profile-name-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button button--dark"
        type="submit"
        disabled={busy || [...name.trim()].length < 2}
      >
        {busy ? "Saving…" : "Save your name"}
        <ArrowRight size={16} />
      </button>
    </form>
  );
}

export function ProfileSetup({
  onSaved,
}: {
  onSaved: (session: Session) => void;
}) {
  return (
    <main id="workspace-main" className="profile-onboarding">
      <section
        className="profile-setup-card"
        aria-labelledby="profile-setup-title"
      >
        <span className="profile-setup-avatar" aria-hidden="true">
          <UserRound size={28} />
        </span>
        <h1 id="profile-setup-title">Let’s get to know you.</h1>
        <p>Choose a name for your profile and the events you host.</p>
        <ProfileNameForm onSaved={onSaved} />
      </section>
    </main>
  );
}

export function ProfileWelcome({
  name,
  onContinue,
}: {
  name: string;
  onContinue: () => void;
}) {
  return (
    <main id="workspace-main" className="profile-onboarding profile-welcome">
      <section
        className="profile-welcome-content"
        aria-labelledby="profile-welcome-title"
      >
        <span className="profile-welcome-avatar" aria-hidden="true">
          {name[0]?.toUpperCase()}
        </span>
        <h1 id="profile-welcome-title">Welcome to CommitPass</h1>
        <p>{name}</p>
        <button className="button" onClick={onContinue}>
          Continue
          <ArrowRight size={16} />
        </button>
      </section>
    </main>
  );
}
