"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
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
  type EventAppearance,
} from "@commitpass/shared";
import {
  ArrowRight,
  CalendarDays,
  AlignLeft,
  Clock3,
  Globe2,
  Pencil,
  Check,
  MapPin,
  Save,
  Ticket,
  Users,
  ImagePlus,
  Palette,
  Shuffle,
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
import { EventLocation } from "./event-location";
import { FieldEditorDialog, type FieldEditor } from "./field-editors";
import { CoverEditor, ThemeEditor } from "./appearance-editors";
import { usePageAppearance } from "./page-theme";
import { isLocal, runtimeStorageKey } from "@/lib/runtime-network";
import {
  coverTemplates,
  convertZone,
  dateText,
  defaultCover,
  eventTimestamp,
  registrationCutoff,
  freshDraft,
  restoreDraft,
  timeText,
  zoneOffset,
  type EventDraft,
} from "@/lib/event-editor";

type Draft = EventDraft;
type Pending = { hash: Hash; owner: Address; metadata: EventMetadata };

export function CreateEvent() {
  const { authenticated, user, getAccessToken } = usePrivy();
  const { session, refresh } = useAccount();
  const { wallets } = useWallets();
  const wallet = wallets.find((wallet) => wallet.walletClientType === "privy");
  const { createWallet } = useCreateWallet();
  const { sendTransaction } = useSendTransaction();
  const [draft, setDraft] = useState<Draft>(freshDraft);
  const [pending, setPending] = useState<Pending | null>(null);
  const [created, setCreated] = useState<Address | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [publishReady, setPublishReady] = useState(false);
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [editor, setEditor] = useState<FieldEditor | "cover" | "theme" | null>(
    null,
  );
  const [editorError, setEditorError] = useState("");
  const [themePreview, setThemePreview] = useState<EventAppearance | null>(
    null,
  );
  const locationAnchor = useRef<HTMLButtonElement>(null);
  usePageAppearance(
    editor === "theme" && themePreview ? themePreview : draft.appearance,
  );
  const draftKey = `commitpass:event-draft:${user?.id ?? "guest"}`;
  const pendingKey = runtimeStorageKey(
    `commitpass:pending-event:${user?.id ?? "guest"}`,
  );

  useEffect(() => {
    setHydrated(false);
    setCreated(null);
    setPending(null);
    setDraft(freshDraft());
    try {
      const saved =
        localStorage.getItem(draftKey) ||
        localStorage.getItem("commitpass:event-draft:guest");
      if (saved) setDraft(restoreDraft(JSON.parse(saved)));
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

  function update(key: keyof Draft, value: Draft[keyof Draft]) {
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
    if (busy || editor) return;
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
      const start = eventTimestamp(draft.start, draft.timezone);
      const end = eventTimestamp(draft.end, draft.timezone);
      const deadline = registrationCutoff(
        draft.deadline,
        draft.start,
        draft.timezone,
      );
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
          posterUrl: draft.posterUrl || defaultCover,
          timezone: draft.timezone,
          appearance: draft.appearance,
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

  const locked = busy || Boolean(pending) || Boolean(created) || !hydrated;
  function openEditor(field: FieldEditor | "cover" | "theme") {
    if (locked) return;
    setEditorError("");
    if (field === "theme") setThemePreview({ ...draft.appearance });
    setEditor(field);
  }
  function applyField(field: FieldEditor, value: string) {
    setEditorError("");
    try {
      if (field === "timezone") {
        setDraft({
          ...draft,
          start: convertZone(draft.start, draft.timezone, value),
          end: convertZone(draft.end, draft.timezone, value),
          deadline: convertZone(draft.deadline, draft.timezone, value),
          timezone: value,
        });
      } else if (
        field === "start-date" ||
        field === "start-time" ||
        field === "end-date" ||
        field === "end-time"
      ) {
        const key = field.startsWith("start") ? "start" : "end";
        const [date, time] = draft[key].split("T");
        const next = field.endsWith("-date")
          ? value + "T" + (time || "18:00")
          : date + "T" + value;
        eventTimestamp(next, draft.timezone);
        update(key, next);
      } else if (field === "deadline") {
        const timestamp = registrationCutoff(
          value,
          draft.start,
          draft.timezone,
        );
        if (
          timestamp <= Math.floor(Date.now() / 1000) ||
          timestamp >= eventTimestamp(draft.start, draft.timezone)
        )
          throw new Error(
            "Choose a future registration deadline no later than the start time.",
          );
        update("deadline", value);
      } else update(field, value);
      setEditor(null);
      setMessage("");
      setError("");
    } catch (error) {
      setEditorError(
        error instanceof Error ? error.message : "Please check this value.",
      );
    }
  }
  function fieldValue(field: FieldEditor) {
    if (field.startsWith("start-")) return draft.start;
    if (field.startsWith("end-")) return draft.end;
    return draft[
      field as
        | "description"
        | "location"
        | "capacity"
        | "commitment"
        | "deadline"
        | "timezone"
    ];
  }

  return (
    <main id="workspace-main" className="workspace-content create-workspace">
      <h1 className="sr-only">Create an event</h1>
      <form onSubmit={publish} className="create-grid">
        <aside>
          <button
            className="cover-choice-trigger"
            type="button"
            aria-label="Choose event cover"
            disabled={locked}
            onClick={() => openEditor("cover")}
          >
            <EventCover
              title={draft.title}
              posterUrl={draft.posterUrl || defaultCover}
            />
            <span className="cover-choice-icon">
              <ImagePlus size={18} />
            </span>
          </button>
          <div className="theme-picker-row">
            <button
              type="button"
              className="theme-picker-trigger"
              disabled={locked}
              onClick={() => openEditor("theme")}
            >
              <span
                className="theme-picker-swatch"
                style={{ background: draft.appearance.color }}
              >
                <Palette size={20} />
              </span>
              <span>
                <small>Theme</small>
                <strong>{draft.appearance.style}</strong>
              </span>
              <Pencil size={14} />
            </button>
            <button
              type="button"
              className="cover-shuffle"
              aria-label="Choose another default cover"
              title="Shuffle cover"
              disabled={locked}
              onClick={() => {
                const options = coverTemplates.filter(
                  (cover) => cover.url !== draft.posterUrl,
                );
                const next =
                  options[Math.floor(Math.random() * options.length)];
                if (next) update("posterUrl", next.url);
              }}
            >
              <Shuffle size={18} />
            </button>
          </div>
        </aside>
        <div className="create-fields">
          <div className="create-context">
            <span>
              <CalendarDays size={15} />
              {authenticated ? "Your event" : "New event"}
            </span>
            <span title="Published events appear in Discover">
              <Globe2 size={14} />
              Public
            </span>
          </div>
          <fieldset disabled={locked}>
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
            <div className="create-schedule">
              <div className="create-date-rows">
                {(["start", "end"] as const).map((key) => (
                  <div className="create-date-row" key={key}>
                    <span className="schedule-dot" aria-hidden="true" />
                    <span>{key === "start" ? "Start" : "End"}</span>
                    <button
                      type="button"
                      aria-label={"Edit " + key + " date"}
                      onClick={() =>
                        openEditor(key === "start" ? "start-date" : "end-date")
                      }
                    >
                      {dateText(draft[key])}
                    </button>
                    <button
                      type="button"
                      aria-label={"Edit " + key + " time"}
                      onClick={() =>
                        openEditor(key === "start" ? "start-time" : "end-time")
                      }
                    >
                      {timeText(draft[key])}
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="create-timezone"
                aria-label="Change event timezone"
                onClick={() => openEditor("timezone")}
              >
                <Globe2 size={16} />
                <strong>{zoneOffset(draft.timezone, draft.start)}</strong>
                <span>
                  {draft.timezone.split("/").pop()?.replaceAll("_", " ")}
                </span>
              </button>
            </div>
            <button
              ref={locationAnchor}
              type="button"
              className="create-location editor-row-trigger"
              onClick={() => openEditor("location")}
            >
              <MapPin size={18} />
              <span>
                <strong>{draft.location || "Add event location"}</strong>
                <small>Offline location or virtual link</small>
              </span>
              {draft.location && <Pencil size={13} />}
            </button>
            <EventLocation location={draft.location} compact />
            <button
              type="button"
              className="create-description-trigger editor-row-trigger"
              onClick={() => openEditor("description")}
            >
              <AlignLeft size={17} />
              <span>
                {draft.description ? "Edit description" : "Add description"}
                {draft.description && (
                  <small>
                    {draft.description.replace(/\s+/g, " ").slice(0, 80)}
                  </small>
                )}
              </span>
              <Pencil size={13} />
            </button>
            <h2>Event options</h2>
            <div className="create-options popup-options">
              <button type="button" onClick={() => openEditor("commitment")}>
                <Ticket size={18} />
                <span>Commitment</span>
                <strong>
                  {draft.commitment} <small>mockAUSD</small>
                </strong>
                <Pencil size={13} />
              </button>
              <button type="button" onClick={() => openEditor("deadline")}>
                <Clock3 size={17} />
                <span>Registration closes</span>
                <strong>
                  {dateText(draft.deadline)} · {timeText(draft.deadline)}
                </strong>
                <Pencil size={13} />
              </button>
              <button type="button" onClick={() => openEditor("capacity")}>
                <Users size={18} />
                <span>Capacity</span>
                <strong>{draft.capacity} guests</strong>
                <Pencil size={13} />
              </button>
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
              href={explorer + "/tx/" + pending.hash}
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
                disabled={!hydrated || busy}
              >
                <Save size={16} />
                Save draft
              </button>
            )}
            {created && !pending ? (
              <Link className="button button--dark" href={"/events/" + created}>
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
                disabled={busy || !session}
              >
                Set up your wallet
              </button>
            ) : (
              <button
                className="button button--dark"
                type="submit"
                disabled={
                  busy || !session || (!pending && (!publishReady || checking))
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
            {isLocal ? "Local Anvil" : "Monad testnet"} · mockAUSD has no
            monetary value. Publishing requires testnet MON for gas.
          </p>
        </div>
      </form>
      {editor && editor !== "cover" && editor !== "theme" && (
        <FieldEditorDialog
          key={editor}
          field={editor}
          value={fieldValue(editor)}
          timezone={draft.timezone}
          start={draft.start}
          anchor={editor === "location" ? locationAnchor.current : undefined}
          error={editorError}
          onConfirm={(value) => applyField(editor, value)}
          onClose={() => setEditor(null)}
        />
      )}
      {editor === "cover" && (
        <CoverEditor
          value={draft.posterUrl}
          onConfirm={(url) => {
            update("posterUrl", url);
            setEditor(null);
          }}
          onClose={() => setEditor(null)}
        />
      )}
      {editor === "theme" && themePreview && (
        <ThemeEditor
          value={themePreview}
          onChange={setThemePreview}
          onConfirm={() => {
            update("appearance", themePreview);
            setEditor(null);
          }}
          onClose={() => setEditor(null)}
        />
      )}
    </main>
  );
}
