"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
import { encodeFunctionData, type Hash } from "viem";
import {
  eventVaultAbi,
  MONAD_TESTNET,
  type EventSummary,
} from "@commitpass/shared";
import { ArrowUpRight, Check, Clock3, Play, Square } from "lucide-react";
import { chainClient, explorer } from "@/lib/chain";
import { amount, statusLabel, jsonRequest } from "@/lib/events";
import { EditorDialog, DialogActions } from "./editor-dialog";
import { HostTools } from "./host-tools";
import { readEventState, type LiveEventState } from "./use-event-state";
import { useAccount } from "./account-context";
import { isLocal, runtimeStorageKey } from "@/lib/runtime-network";

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
  const { authenticated, ready } = usePrivy();
  const account = useAccount();
  const { wallets } = useWallets();
  const wallet = wallets.find(
    (item) => item.address.toLowerCase() === live?.owner.toLowerCase(),
  );
  const { sendTransaction } = useSendTransaction();
  const [confirmation, setConfirmation] = useState<
    "start" | "end" | "cancel" | null
  >(null);
  const [pending, setPending] = useState<Hash | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const key = runtimeStorageKey(
    `commitpass:lifecycle:${event.vault}:${wallet?.address ?? "none"}`,
  );
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
    const updated = await readEventState(event.vault);
    setMessage(
      updated.outcome === 3
        ? "Cancellation confirmed. All guests can claim their full commitment."
        : updated.settled
          ? "Event ended. Guest returns are available."
          : "Request confirmed. Waiting for automation to execute the next step.",
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
      if (
        action === "cancel" &&
        (state.started ||
          state.settled ||
          state.startRequested ||
          state.timestamp >= state.start)
      )
        throw new Error(
          "Cancellation is only available before the start time and before any start request.",
        );
      localStorage.setItem(`${key}:ready`, "1");
      localStorage.removeItem(`${key}:ready`);
      await wallet.switchChain(MONAD_TESTNET.chainId);
      let data: `0x${string}`;
      const to = event.vault;
      if (action === "cancel") {
        await chainClient.simulateContract({
          address: to,
          abi: eventVaultAbi,
          functionName: "cancelEvent",
          account: wallet.address as `0x${string}`,
        });
        data = encodeFunctionData({
          abi: eventVaultAbi,
          functionName: "cancelEvent",
        });
      } else {
        const functionName =
          action === "start" ? "requestStart" : "requestSettlement";
        await chainClient.simulateContract({
          address: to,
          abi: eventVaultAbi,
          functionName,
          account: wallet.address as `0x${string}`,
        });
        data = encodeFunctionData({
          abi: eventVaultAbi,
          functionName,
        });
      }
      setMessage("Confirm this request in your wallet.");
      const tx = await sendTransaction(
        { to, chainId: MONAD_TESTNET.chainId, data },
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
            {amount((live.count * live.stake).toString())} <small>USDC</small>
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
          ["Event ended", live.settled],
        ].map(([label, done]) => (
          <li key={String(label)} className={done ? "complete" : ""}>
            {done ? <Check size={15} /> : <Clock3 size={15} />} {label}
          </li>
        ))}
      </ol>
      <div className="host-lifecycle">
        <h3>
          {live.outcome === 3
            ? "Event cancelled."
            : live.outcome === 2
              ? "Full refunds are available."
              : live.settled
                ? "All wrapped up."
                : ending
                  ? "Your event is wrapping up."
                  : live.started
                    ? "Your event is live."
                    : starting
                      ? "Waiting for the event to start."
                      : "Ready when your people are."}
        </h3>
        <p>
          {live.outcome === 3
            ? "Cancellation is confirmed onchain. Every guest can claim their full commitment with no fee."
            : live.outcome === 2
              ? "No attendance was recorded in the finalized snapshot. Every guest can claim their commitment plus a share of recovered yield. No platform fee applies."
              : live.settled
                ? "The event has ended. Eligible guests can collect their return from the event page."
                : ending
                  ? "Check-in is closed. Automation will use the attendance snapshot to settle commitments. This page refreshes automatically."
                  : live.started
                    ? "Check guests in below. Ending the event closes check-in and starts preparing guest returns."
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
        {isLocal &&
          !pending &&
          !live.settled &&
          !live.started &&
          !live.startRequested &&
          live.timestamp < live.start && (
            <button
              className="button cancel-event-button"
              disabled={busy || !wallet}
              onClick={() => setConfirmation("cancel")}
            >
              Cancel event
            </button>
          )}
        {isLocal && live.settled && (
          <p className="field-note">
            Allocated to guests: {amount(live.allocated.toString())} USDC ·
            Claimed: {amount(live.claimed.toString())} · Platform revenue:{" "}
            {amount(live.revenue.toString())}
          </p>
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
      {confirmation && !busy && (
        <EditorDialog
          title={
            confirmation === "cancel"
              ? "Cancel this event?"
              : confirmation === "start"
                ? "Start this event?"
                : "End this event?"
          }
          description={
            confirmation === "cancel"
              ? "This permanently closes the event. Every depositor will be able to claim their full commitment, with no platform fee. Funds stay in the contract until claimed."
              : confirmation === "start"
                ? "Registration closes immediately. Automation will then start the event and move commitments into the yield vault."
                : "Check-in closes immediately. Confirm every present guest before continuing. Automation will settle using the frozen attendance snapshot. If nobody is checked in, all guests receive a full refund plus recovered yield, with no platform fee."
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
                    : confirmation === "cancel"
                      ? "Cancel event & enable refunds"
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
