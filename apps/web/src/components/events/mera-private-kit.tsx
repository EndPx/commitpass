"use client";

import { useEffect, useState } from "react";
import {
  createSecretVaultWithExistingPasskey,
  createSecretVaultWithNewPasskey,
  decryptSecretVaultWithPasskey,
  parseSecretVault,
  type PasskeyCredentialMetadata,
  type PasskeySecretVault,
} from "@category-labs/mera";
import { LockKeyhole, ShieldCheck, Unlock } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { jsonRequest } from "@/lib/events";

type Kit = {
  doorCode: string;
  instructions: string;
};
type Props = { eventVault: string; eventTitle: string };
const rpName = "CommitPass private event kit";

function encodeKit(value: Kit) {
  return new TextEncoder().encode(JSON.stringify(value));
}
function decodeKit(value: Uint8Array) {
  const parsed = JSON.parse(new TextDecoder().decode(value)) as Partial<Kit>;
  if (
    typeof parsed.doorCode !== "string" ||
    typeof parsed.instructions !== "string"
  )
    throw new Error("This private kit has an invalid format.");
  return { doorCode: parsed.doorCode, instructions: parsed.instructions };
}
export function MeraPrivateKit({ eventVault, eventTitle }: Props) {
  const { getAccessToken, user } = usePrivy();
  const [rpId, setRpId] = useState("");
  const [vault, setVault] = useState<PasskeySecretVault | null>(null);
  const [credential, setCredential] =
    useState<PasskeyCredentialMetadata | null>(null);
  const [kit, setKit] = useState<Kit | null>(null);
  const [draft, setDraft] = useState<Kit>({ doorCode: "", instructions: "" });
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => setRpId(window.location.hostname), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    setVault(null);
    setKit(null);
    setCredential(null);
    setError("");
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Please sign in again.");
        const headers = { Authorization: `Bearer ${token}` };
        const [accountResponse, kitResponse] = await Promise.all([
          fetch("/api/me/mera-credential", { headers, cache: "no-store" }),
          fetch(`/api/events/${eventVault}/private-kit`, {
            headers,
            cache: "no-store",
          }),
        ]);
        if (
          !accountResponse.ok ||
          (kitResponse.status !== 404 && !kitResponse.ok)
        )
          throw new Error("Could not load your private kit. Please try again.");
        const account = (await accountResponse.json()) as {
          credential: PasskeyCredentialMetadata | null;
        };
        const parsed = kitResponse.ok
          ? parseSecretVault(
              ((await kitResponse.json()) as { vault: unknown }).vault,
            )
          : null;
        if (active) {
          setCredential(account.credential);
          setVault(parsed);
          setLoadFailed(false);
          if (parsed)
            setMessage("Private kit found. Unlock it with your Mera passkey.");
        }
      } catch (value) {
        if (active) {
          setLoadFailed(true);
          setError(
            value instanceof Error
              ? value.message
              : "Could not load private kit.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [eventVault, getAccessToken]);

  async function unlock() {
    if (!vault || busy || !rpId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const bytes = await decryptSecretVaultWithPasskey({ rpId, vault });
      try {
        const value = decodeKit(bytes);
        setKit(value);
        setDraft(value);
      } finally {
        bytes.fill(0);
      }
      if (!credential) {
        const token = await getAccessToken();
        if (!token) throw new Error("Please sign in again.");
        const linked = await jsonRequest<{
          credential: PasskeyCredentialMetadata;
        }>("/api/me/mera-credential", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ credential: vault.credential }),
        });
        setCredential(linked.credential);
      }
      setMessage("Private kit unlocked. It is only held in this page memory.");
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Could not unlock the private kit.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (
      busy ||
      loadFailed ||
      !rpId ||
      (!draft.doorCode.trim() && !draft.instructions.trim())
    ) {
      setError("Add a door code or private instruction before saving.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let next: PasskeySecretVault;
      const selected = credential ?? vault?.credential;
      if (
        credential &&
        vault &&
        credential.credentialId !== vault.credential.credentialId
      )
        throw new Error(
          "This kit belongs to a different passkey. Unlock it before changing it.",
        );
      const secret = encodeKit(draft);
      try {
        if (selected) {
          next = await createSecretVaultWithExistingPasskey({
            rpId,
            credential: selected,
            secret,
          });
        } else {
          next = await createSecretVaultWithNewPasskey({
            rp: { id: rpId, name: rpName },
            user: {
              name: `${user?.id ?? "organizer"}@commitpass.local`,
              displayName: `CommitPass host · ${eventTitle}`,
            },
            secret,
          });
        }
      } finally {
        secret.fill(0);
      }
      const token = await getAccessToken();
      if (!token) throw new Error("Please sign in again.");
      const linked = await jsonRequest<{
        credential: PasskeyCredentialMetadata;
      }>("/api/me/mera-credential", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ credential: next.credential }),
      });
      setCredential(linked.credential);
      await jsonRequest(`/api/events/${eventVault}/private-kit`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vault: next }),
      });
      setVault(next);
      setKit(draft);
      setEditing(false);
      setMessage(
        "Encrypted private kit saved. The server received ciphertext only.",
      );
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Could not save the encrypted private kit.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mera-private-kit">
      <div className="mera-private-kit-heading">
        <div>
          <ShieldCheck size={18} />
          <div>
            <strong>Private event kit</strong>
            <small>
              Encrypted by a Mera passkey · never readable by the server
            </small>
          </div>
        </div>
        {vault && !kit && (
          <button type="button" onClick={unlock} disabled={busy}>
            {busy ? (
              "Unlocking…"
            ) : (
              <>
                <Unlock size={14} /> Unlock
              </>
            )}
          </button>
        )}
      </div>
      {loading ? (
        <p className="field-note">Checking for an encrypted private kit…</p>
      ) : !vault && !editing && !loadFailed ? (
        <div className="mera-private-kit-empty">
          <p>
            Keep door codes and host instructions private. One Mera ceremony
            creates an event-specific encrypted vault.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setError("");
              setMessage("");
            }}
            disabled={busy}
          >
            <LockKeyhole size={14} /> Create private kit
          </button>
        </div>
      ) : null}
      {kit && !editing && (
        <div className="mera-private-kit-revealed">
          <dl>
            <div>
              <dt>Door code</dt>
              <dd>{kit.doorCode || "Not set"}</dd>
            </div>
            <div>
              <dt>Host instructions</dt>
              <dd>{kit.instructions || "Not set"}</dd>
            </div>
          </dl>
          <div className="mera-private-kit-actions">
            <button
              type="button"
              onClick={() => {
                setDraft(kit);
                setEditing(true);
              }}
            >
              Edit kit
            </button>
            <button
              type="button"
              onClick={() => {
                setKit(null);
                setDraft({ doorCode: "", instructions: "" });
                setMessage("Private kit locked.");
              }}
            >
              Lock
            </button>
          </div>
        </div>
      )}
      {editing && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="mera-private-kit-form"
        >
          <label>
            Door code
            <input
              value={draft.doorCode}
              maxLength={160}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  doorCode: event.target.value,
                }))
              }
              placeholder="Only your host team should see this"
            />
          </label>
          <label>
            Private instructions
            <textarea
              value={draft.instructions}
              maxLength={5000}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  instructions: event.target.value,
                }))
              }
              placeholder="Arrival notes, access instructions, emergency contact…"
            />
          </label>
          <div className="mera-private-kit-actions">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" disabled={busy}>
              {busy ? "Encrypting…" : "Encrypt and save"}
            </button>
          </div>
        </form>
      )}
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <small className="mera-private-kit-footnote">
        Each event has its own random PRF salt and AES-256-GCM ciphertext. One
        synced passkey can unlock your kits across devices on this same domain.
      </small>
    </section>
  );
}
