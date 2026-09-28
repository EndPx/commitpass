"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
import { encodeFunctionData, type Hash } from "viem";
import {
  eventAutomationAbi,
  MONAD_TESTNET,
  type EventSummary,
} from "@commitpass/shared";
import { ArrowUpRight, Check, Clock3, Play, Square } from "lucide-react";
import { automationAddress, chainClient, explorer } from "@/lib/chain";
import { amount, statusLabel, jsonRequest } from "@/lib/events";
import { EditorDialog, DialogActions } from "./editor-dialog";
import { HostTools } from "./host-tools";
import { readEventState, type LiveEventState } from "./use-event-state";
import { useAccount } from "./account-context";

export function HostManagement({
  event,
  live,
  owner,
  refresh,
}: {
  event: EventSummary;
  live: LiveEventState | null;
  owner: boolean;
  refresh: () => void;
}) {
  const { authenticated, ready, getAccessToken } = usePrivy();
  const account = useAccount();
  const { wallets } = useWallets();
  const wallet = wallets.find(
    (item) => item.address.toLowerCase() === live?.owner.toLowerCase(),
  );
  const { sendTransaction } = useSendTransaction();
  const [confirmation, setConfirmation] = useState<"start" | "end" | null>(
    null,
  );
  const [pending, setPending] = useState<Hash | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const key = `commitpass:lifecycle:${event.vault}:${wallet?.address ?? "none"}`;
  useEffect(() => {
    setPending(null);
    setError("");
    setMessage("");
    try {
      const hash = localStorage.getItem(key);
      if (hash && /^0x[\da-f]{64}$/i.test(hash)) setPending(hash as Hash);
    } catch {
      setError("Transaction recovery storage is unavailable in this browser.");
    }
  }, [key]);
  async function receipt(hash: Hash) {
    const result = await chainClient.waitForTransactionReceipt({
      hash,
      confirmations: 2,
      timeout: 120000,
    });
    localStorage.removeItem(key);
    setPending(null);
    if (result.status !== "success")
      throw new Error("The request did not complete. You can try again.");
    setMessage(
      "Request confirmed. Waiting for automation to execute the next step.",
    );
  }
  async function execute() {
    if (busy || !wallet || !owner || !account.session) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (pending) {
        await receipt(pending);
        return;
      }
      const state = await readEventState(event.vault);
      if (state.owner.toLowerCase() !== wallet.address.toLowerCase())
        throw new Error("Connect the event owner’s wallet.");
      const action = confirmation;
      if (!action) return;
      if (
        action === "start" &&
        (state.started ||
          state.startRequested ||
          state.settled ||
          state.count === 0n)
      )
        throw new Error(
          "The event needs a committed guest and must not already be starting.",
        );
      if (
        action === "end" &&
        (!state.started ||
          state.settled ||
          state.settlementRequested ||
          state.timestamp >= state.cutoff)
      )
        throw new Error("This event is already wrapping up or is not active.");
      if (action === "end") {
        const token = await getAccessToken();
        if (!token) throw new Error("Please sign in again.");
        const attendance = await jsonRequest<{ checkIns: unknown[] }>(
          `/api/events/${event.vault}/check-ins`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!attendance.checkIns.length)
          throw new Error(
            "Check in at least one attendee before ending the event. Settlement requires a confirmed attendee.",
          );
      }
      localStorage.setItem(`${key}:ready`, "1");
      localStorage.removeItem(`${key}:ready`);
      await wallet.switchChain(MONAD_TESTNET.chainId);
      const functionName =
        action === "start" ? "requestStart" : "requestSettlement";
      await chainClient.simulateContract({
        address: automationAddress,
        abi: eventAutomationAbi,
        functionName,
        args: [event.vault],
        account: wallet.address as `0x${string}`,
      });
      const tx = await sendTransaction(
        {
          to: automationAddress,
          chainId: MONAD_TESTNET.chainId,
          data: encodeFunctionData({
            abi: eventAutomationAbi,
            functionName,
            args: [event.vault],
          }),
        },
        { address: wallet.address, uiOptions: { showWalletUIs: true } },
      );
      setPending(tx.hash);
      localStorage.setItem(key, tx.hash);
      setConfirmation(null);
      await receipt(tx.hash);
    } catch (err) {
      setError(
        err instanceof Error &&
          !/0x[\da-f]{20}|ContractFunction|Execution reverted/i.test(
            err.message,
          )
          ? err.message
          : "Could not complete the request. Check any submitted transaction before retrying.",
      );
    } finally {
      setBusy(false);
      setConfirmation(null);
      refresh();
    }
  }
  if (!ready || account.connecting)
    return (
      <section className="host-dashboard">
        <p>Connecting your host account…</p>
      </section>
    );
  if (!authenticated)
    return (
      <section className="host-dashboard">
        <h2>Manage your event</h2>
        <p>Sign in with the account that created this event.</p>
        <Link
          className="button button--dark"
          href={`/signin?next=${encodeURIComponent(`/events/${event.vault}/manage`)}`}
        >
          Sign in to manage
        </Link>
      </section>
    );
  if (!live || account.error)
    return (
      <section className="host-dashboard">
        <p>{account.error || "Connecting to the event’s live status…"}</p>
        <button
          className="button"
          onClick={() => {
            account.refresh();
            refresh();
          }}
        >
          Reconnect
        </button>
      </section>
    );
  if (!owner)
    return (
      <section className="host-dashboard">
        <h2>Host access required</h2>
        <p>Only the event owner can manage attendance and lifecycle.</p>
        <Link href={`/events/${event.vault}`}>Back to event</Link>
      </section>
    );
  const starting =
    !live.started && (live.startRequested || live.timestamp >= live.start);
  const ending =
    live.started &&
    !live.settled &&
    (live.settlementRequested || live.timestamp >= live.cutoff);
  return (
    <section className="host-dashboard">
      <div className="host-dashboard-heading">
        <div>
          <small>HOST WORKSPACE</small>
          <h2>Make it a good gathering.</h2>
        </div>
        <Link href={`/events/${event.vault}`}>
          View event <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="host-stats">
        <div>
          <span>Guests</span>
          <strong>
            {live.count.toString()} <small>/ {live.capacity.toString()}</small>
          </strong>
        </div>
        <div>
          <span>Committed</span>
          <strong>
            {amount((live.count * live.stake).toString())}{" "}
            <small>mockAUSD</small>
          </strong>
        </div>
        <div>
          <span>Event status</span>
          <strong className="host-status-value">{statusLabel(event)}</strong>
        </div>
      </div>
      <ol className="lifecycle-steps">
        {[
          ["Registration", true],
          ["Event started", live.started],
          ["Settled", live.settled],
        ].map(([label, done]) => (
          <li key={String(label)} className={done ? "complete" : ""}>
            {done ? <Check size={15} /> : <Clock3 size={15} />} {label}
          </li>
        ))}
      </ol>
      <div className="host-lifecycle">
        <h3>
          {live.settled
            ? "All wrapped up."
            : ending
              ? "Settlement is in progress."
              : live.started
                ? "Your event is live."
                : starting
                  ? "Waiting for the event to start."
                  : "Ready when your people are."}
        </h3>
        <p>
          {live.settled
            ? "Settlement is confirmed. Eligible guests can claim their return from their event page."
            : ending
              ? "Check-in is closed. Automation will use the attendance snapshot to settle commitments. This page refreshes automatically."
              : live.started
                ? "Check guests in below. Ending the event closes check-in immediately and requests settlement."
                : starting
                  ? "Automation is waiting to execute the start. This page updates when the contract confirms it."
                  : "Starting closes registration and asks automation to put the committed funds into the event’s yield vault."}
        </p>
        {pending ? (
          <button
            className="button button--dark"
            disabled={busy}
            onClick={execute}
          >
            {busy ? "Checking request…" : "Check submitted request"}
          </button>
        ) : (
          !live.settled && (
            <button
              className="button button--dark"
              disabled={
                busy ||
                !wallet ||
                (live.started
                  ? ending
                  : live.startRequested || live.count === 0n)
              }
              onClick={() => setConfirmation(live.started ? "end" : "start")}
            >
              {live.started ? <Square size={15} /> : <Play size={15} />}
              {live.started ? "End event" : "Start event"}
            </button>
          )
        )}
        {!wallet && (
          <p className="field-note">
            Connect the wallet used to create this event to send a lifecycle
            request.
          </p>
        )}
        {pending && (
          <a
            className="receipt-link"
            href={`${explorer}/tx/${pending}`}
            target="_blank"
            rel="noreferrer"
          >
            View request transaction <ArrowUpRight size={13} />
          </a>
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
      </div>
      <HostTools event={event} refresh={refresh} />
      {confirmation && (
        <EditorDialog
          title={
            confirmation === "start" ? "Start this event?" : "End this event?"
          }
          description={
            confirmation === "start"
              ? "Registration closes immediately. Automation will then start the event and move commitments into the yield vault."
              : "Check-in closes immediately. Confirm every present guest before continuing. Automation will settle using the frozen attendance snapshot."
          }
          busy={busy}
          onClose={() => setConfirmation(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void execute();
            }}
          >
            <DialogActions
              disabled={busy}
              onCancel={() => setConfirmation(null)}
              label={
                busy
                  ? "Confirming…"
                  : confirmation === "start"
                    ? "Start event"
                    : "End event"
              }
            />
          </form>
        </EditorDialog>
      )}
      {live.count === 0n && !live.started && (
        <p className="field-note">
          At least one guest must reserve a spot before this event can start.
        </p>
      )}
    </section>
  );
}
