"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  useCreateWallet,
  usePrivy,
  useSendTransaction,
  useWallets,
} from "@privy-io/react-auth";
import {
  decodeEventLog,
  encodeFunctionData,
  parseUnits,
  zeroHash,
  type Address,
  type Hash,
} from "viem";
import {
  eventAutomationAbi,
  factoryAbi,
  MONAD_TESTNET,
  type EventMetadata,
} from "@commitpass/shared";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  MapPin,
  Save,
  Ticket,
  Users,
} from "lucide-react";
import {
  chainClient,
  factoryAddress,
  automationAddress,
  explorer,
} from "@/lib/chain";
import { jsonRequest } from "@/lib/events";
import { useAccount } from "./account-context";
import { EventCover } from "./event-cover";
import { CoverUpload } from "./cover-upload";

type Draft = EventMetadata & {
  start: string;
  end: string;
  deadline: string;
  commitment: string;
  capacity: string;
};
type Pending = { hash: Hash; owner: Address; metadata: EventMetadata };
const blank: Draft = {
  title: "",
  description: "",
  location: "",
  posterUrl: "",
  start: "",
  end: "",
  deadline: "",
  commitment: "5",
  capacity: "30",
};

export function CreateEvent() {
  const { authenticated, user, getAccessToken } = usePrivy();
  const { session, refresh } = useAccount();
  const { wallets } = useWallets();
  const wallet = wallets.find((wallet) => wallet.walletClientType === "privy");
  const { createWallet } = useCreateWallet();
  const { sendTransaction } = useSendTransaction();
  const [draft, setDraft] = useState<Draft>(blank);
  const [pending, setPending] = useState<Pending | null>(null);
  const [created, setCreated] = useState<Address | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [publishReady, setPublishReady] = useState(false);
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [zone, setZone] = useState("");
  const draftKey = `commitpass:event-draft:${user?.id ?? "guest"}`;
  const pendingKey = `commitpass:pending-event:${user?.id ?? "guest"}`;

  useEffect(() => {
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setHydrated(false);
    setCreated(null);
    setPending(null);
    setDraft(blank);
    try {
      const saved =
        localStorage.getItem(draftKey) ||
        localStorage.getItem("commitpass:event-draft:guest");
      if (saved) {
        const value = JSON.parse(saved);
        if (Object.keys(blank).every((key) => typeof value[key] === "string"))
          setDraft(value);
      }
      const savedPending = localStorage.getItem(pendingKey);
      if (savedPending) {
        const value = JSON.parse(savedPending);
        if (
          /^0x[0-9a-fA-F]{64}$/.test(value.hash) &&
          /^0x[0-9a-fA-F]{40}$/.test(value.owner) &&
          value.metadata
        )
          setPending(value);
      }
    } catch {
      setError("Your saved draft could not be restored in this browser.");
    }
    setHydrated(true);
  }, [draftKey, pendingKey]);

  useEffect(() => {
    let active = true;
    setChecking(true);
    void chainClient
      .readContract({
        address: automationAddress,
        abi: eventAutomationAbi,
        functionName: "workflowId",
      })
      .then((id) => {
        if (active) setPublishReady(id !== zeroHash);
      })
      .catch(() => {
        if (active) {
          setPublishReady(false);
          setError(
            "Could not check publishing availability. Your draft can still be saved.",
          );
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [checkAttempt]);

  function update(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  }
  function saveDraft() {
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setMessage("Draft saved on this device.");
      setError("");
    } catch {
      setError("This browser couldn’t save the draft. Keep this page open.");
    }
  }

  async function finishCreation(transaction: Pending) {
    setMessage("Waiting for the transaction to confirm…");
    const receipt = await chainClient.waitForTransactionReceipt({
      hash: transaction.hash,
      confirmations: 2,
      timeout: 120000,
    });
    if (receipt.status !== "success") {
      localStorage.removeItem(pendingKey);
      setPending(null);
      throw new Error(
        "The transaction was not completed. You can review and try again.",
      );
    }
    let vault: Address | undefined;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== factoryAddress.toLowerCase()) continue;
      try {
        const event = decodeEventLog({
          abi: factoryAbi,
          eventName: "VaultCreated",
          data: log.data,
          topics: log.topics,
        });
        if (
          event.args.organizer.toLowerCase() === transaction.owner.toLowerCase()
        )
          vault = event.args.vault;
      } catch {
        /* Other factory logs are not creation evidence. */
      }
    }
    if (!vault)
      throw new Error(
        "Could not identify the created event. Keep the transaction reference and try checking again.",
      );
    setCreated(vault);
    setMessage("Event confirmed. Saving your event details…");
    const token = await getAccessToken();
    if (!token)
      throw new Error("Sign in again to finish saving the event details.");
    await jsonRequest(`/api/events/${vault}/metadata`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(transaction.metadata),
    });
    localStorage.removeItem(pendingKey);
    localStorage.removeItem(draftKey);
    setPending(null);
    setMessage(
      "Your event is created and its details are saved. It will appear once indexing catches up.",
    );
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || coverUploading) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (!session || !wallet)
        throw new Error("Connect your account before publishing.");
      if (pending) {
        await finishCreation(pending);
        return;
      }
      if (
        !draft.title.trim() ||
        draft.title.trim().length > 120 ||
        draft.description.length > 5000 ||
        draft.location.length > 300 ||
        draft.posterUrl.length > 2048
      )
        throw new Error("Please check the event name and description lengths.");
      const start = Math.floor(new Date(draft.start).getTime() / 1000);
      const end = Math.floor(new Date(draft.end).getTime() / 1000);
      const deadline = Math.floor(new Date(draft.deadline).getTime() / 1000);
      const block = await chainClient.getBlock();
      if (
        ![start, end, deadline].every(Number.isSafeInteger) ||
        deadline <= Number(block.timestamp) ||
        deadline >= start ||
        end <= start
      )
        throw new Error(
          "Registration must close in the future, before the event starts. The end must be after the start.",
        );
      if (
        !/^\d+(\.\d{1,6})?$/.test(draft.commitment) ||
        parseUnits(draft.commitment, 6) <= 0n
      )
        throw new Error(
          "Enter a positive commitment with up to 6 decimal places.",
        );
      const capacity = Number(draft.capacity);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500)
        throw new Error("Capacity must be between 1 and 500 people.");
      if (draft.posterUrl) {
        const poster = new URL(draft.posterUrl);
        if (poster.protocol !== "https:" || poster.username || poster.password)
          throw new Error("Use a public HTTPS image URL without credentials.");
      }
      const workflow = await chainClient.readContract({
        address: automationAddress,
        abi: eventAutomationAbi,
        functionName: "workflowId",
      });
      if (workflow === zeroHash)
        throw new Error(
          "Publishing is not available on this test network yet. Save your draft for now.",
        );
      localStorage.setItem(draftKey, JSON.stringify(draft));
      await wallet.switchChain(MONAD_TESTNET.chainId);
      const args = [
        parseUnits(draft.commitment, 6),
        BigInt(deadline),
        BigInt(start),
        BigInt(capacity),
        automationAddress,
        BigInt(end),
      ] as const;
      await chainClient.simulateContract({
        address: factoryAddress,
        abi: factoryAbi,
        functionName: "createAutomatedEvent",
        args,
        account: wallet.address as Address,
      });
      setMessage("Confirm event creation in your wallet.");
      const { hash } = await sendTransaction(
        {
          to: factoryAddress,
          chainId: MONAD_TESTNET.chainId,
          data: encodeFunctionData({
            abi: factoryAbi,
            functionName: "createAutomatedEvent",
            args,
          }),
        },
        { address: wallet.address, uiOptions: { showWalletUIs: true } },
      );
      const transaction: Pending = {
        hash,
        owner: wallet.address as Address,
        metadata: {
          title: draft.title.trim(),
          description: draft.description,
          location: draft.location,
          posterUrl: draft.posterUrl,
        },
      };
      setPending(transaction);
      localStorage.setItem(pendingKey, JSON.stringify(transaction));
      await finishCreation(transaction);
    } catch (error) {
      setError(
        error instanceof Error &&
          !/0x[0-9a-f]{20}|ContractFunction|Execution reverted/i.test(
            error.message,
          )
          ? error.message
          : "Could not finish publishing. If a transaction was submitted, use Check transaction before trying again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function setupWallet() {
    setBusy(true);
    setError("");
    try {
      await createWallet();
      refresh();
      setMessage("Your wallet is ready.");
    } catch {
      setError("Could not set up your wallet. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="workspace-main" className="workspace-content create-workspace">
      <Link className="back-link" href="/events">
        <ArrowLeft size={16} />
        Events
      </Link>
      <div className="workspace-title">
        <div>
          <h1>Create an event</h1>
          <p>Bring your people together.</p>
        </div>
        <span className="network-label">Testnet preview</span>
      </div>
      <form onSubmit={publish} className="create-grid">
        <aside>
          <EventCover title={draft.title} posterUrl={draft.posterUrl} />
          <CoverUpload
            value={draft.posterUrl}
            onChange={(url) => update("posterUrl", url)}
            disabled={busy || Boolean(pending) || Boolean(created)}
            onBusyChange={setCoverUploading}
          />
          <div className="create-summary">
            <Ticket size={20} />
            <p>
              A little commitment,
              <br />
              <strong>a better turnout.</strong>
            </p>
            <span>
              Guests get their commitment back after confirmed attendance and
              settlement.
            </span>
          </div>
        </aside>
        <div className="create-fields">
          <fieldset
            disabled={
              busy ||
              coverUploading ||
              Boolean(pending) ||
              Boolean(created) ||
              !hydrated
            }
          >
            <label className="sr-only" htmlFor="event-title">
              Event name
            </label>
            <input
              id="event-title"
              className="event-name-input"
              placeholder="Event name"
              value={draft.title}
              onChange={(event) => update("title", event.target.value)}
              maxLength={120}
              required
            />
            <div className="form-panel">
              <div className="panel-icon">
                <CalendarDays size={20} />
              </div>
              <div className="schedule-fields">
                <label>
                  Start
                  <input
                    type="datetime-local"
                    value={draft.start}
                    onChange={(event) => update("start", event.target.value)}
                    required
                  />
                </label>
                <label>
                  End
                  <input
                    type="datetime-local"
                    value={draft.end}
                    onChange={(event) => update("end", event.target.value)}
                    required
                  />
                </label>
                <label>
                  Registration closes
                  <input
                    type="datetime-local"
                    value={draft.deadline}
                    onChange={(event) => update("deadline", event.target.value)}
                    required
                  />
                </label>
                <p className="field-note">
                  Times are in {zone || "your local timezone"}.
                </p>
              </div>
            </div>
            <label className="form-panel location-field">
              <MapPin size={20} />
              <span>
                Location
                <input
                  placeholder="Add a venue or meeting link"
                  value={draft.location}
                  onChange={(event) => update("location", event.target.value)}
                  maxLength={300}
                  required
                />
              </span>
            </label>
            <label className="description-field">
              About your event
              <textarea
                placeholder="What’s the plan? Tell people what to expect, what to bring, and how check-in works."
                rows={6}
                value={draft.description}
                onChange={(event) => update("description", event.target.value)}
                maxLength={5000}
                required
              />
            </label>
            <h2>Event options</h2>
            <div className="option-fields">
              <label>
                <Ticket size={18} />
                <span>
                  Commitment
                  <small>Returned after attendance & settlement</small>
                </span>
                <div>
                  <input
                    aria-label="Commitment amount"
                    type="number"
                    min="0.000001"
                    step="0.000001"
                    value={draft.commitment}
                    onChange={(event) =>
                      update("commitment", event.target.value)
                    }
                    required
                  />
                  <small>mockAUSD</small>
                </div>
              </label>
              <label>
                <Users size={18} />
                <span>
                  Capacity<small>Make room for the right crowd</small>
                </span>
                <input
                  aria-label="Guest capacity"
                  type="number"
                  min="1"
                  max="500"
                  step="1"
                  value={draft.capacity}
                  onChange={(event) => update("capacity", event.target.value)}
                  required
                />
              </label>
            </div>
          </fieldset>
          {!publishReady && !created && (
            <div className="publish-notice">
              <strong>
                {checking
                  ? "Checking publishing availability…"
                  : "Save your idea. Publish when ready."}
              </strong>
              <p>
                {checking
                  ? "This only reads the network; no transaction is sent."
                  : "Publishing is not available on this test network yet. Your draft can be saved on this device."}
              </p>
              {!checking && (
                <button
                  type="button"
                  onClick={() => setCheckAttempt((value) => value + 1)}
                >
                  Check again
                </button>
              )}
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="form-message" role="status">
              {message}
            </p>
          )}
          {pending && (
            <a
              className="receipt-link"
              href={`${explorer}/tx/${pending.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              View pending creation transaction ↗
            </a>
          )}
          <div className="create-actions">
            {!pending && !created && (
              <button
                className="button"
                type="button"
                onClick={saveDraft}
                disabled={!hydrated || busy || coverUploading}
              >
                <Save size={16} />
                Save draft
              </button>
            )}
            {created && !pending ? (
              <Link className="button button--dark" href={`/events/${created}`}>
                <Check size={16} />
                View event
              </Link>
            ) : !authenticated ? (
              <Link
                className="button button--dark"
                href="/signin?next=%2Fevents%2Fnew"
              >
                Sign in to publish
                <ArrowRight size={16} />
              </Link>
            ) : !wallet ? (
              <button
                className="button button--dark"
                type="button"
                onClick={setupWallet}
                disabled={busy || coverUploading || !session}
              >
                Set up your wallet
              </button>
            ) : (
              <button
                className="button button--dark"
                type="submit"
                disabled={
                  busy ||
                  coverUploading ||
                  !session ||
                  (!pending && (!publishReady || checking))
                }
              >
                {busy
                  ? "Please wait…"
                  : pending
                    ? "Check transaction & save details"
                    : "Publish event"}
                <ArrowRight size={16} />
              </button>
            )}
          </div>
          <p className="field-note">
            Monad testnet · mockAUSD has no monetary value. Publishing requires
            testnet MON for gas.
          </p>
        </div>
      </form>
    </main>
  );
}
