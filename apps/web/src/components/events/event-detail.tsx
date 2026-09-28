"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  useCreateWallet,
  usePrivy,
  useSendTransaction,
  useWallets,
} from "@privy-io/react-auth";
import { encodeFunctionData, erc20Abi, type Address, type Hash } from "viem";
import {
  eventVaultAbi,
  factoryAbi,
  MONAD_TESTNET,
  type EventMetadata,
  type EventSummary,
  type IndexedParticipant,
} from "@commitpass/shared";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  MapPin,
  Ticket,
  Users,
} from "lucide-react";
import {
  amount,
  dateLabel,
  eventTitle,
  jsonRequest,
  shorten,
  statusLabel,
  timeLabel,
} from "@/lib/events";
import {
  assetAddress,
  chainClient,
  explorer,
  factoryAddress,
} from "@/lib/chain";
import { useAccount } from "./account-context";
import { EventCover } from "./event-cover";
import { LoadError } from "./event-list";

export function EventDetail({ vault }: { vault: string }) {
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  const { session } = useAccount();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void jsonRequest<{ data: EventSummary }>(`/api/events/${vault}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setEvent(result.data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [vault, attempt]);
  if (loading && !event)
    return (
      <main className="workspace-content" id="workspace-main">
        <div className="detail-skeleton" aria-label="Loading event" />
      </main>
    );
  if (error || !event)
    return (
      <main className="workspace-content" id="workspace-main">
        <Link className="back-link" href="/discover">
          <ArrowLeft size={16} />
          Discover
        </Link>
        <LoadError
          message={error || "This event has not been indexed yet."}
          retry={refresh}
        />
      </main>
    );
  const owner = session?.wallets.some(
    (wallet) => wallet.toLowerCase() === event.owner.toLowerCase(),
  );
  return (
    <main className="workspace-content detail-workspace" id="workspace-main">
      <Link className="back-link" href="/events">
        <ArrowLeft size={16} />
        Events
      </Link>
      <div className="detail-grid">
        <aside className="detail-aside">
          <EventCover
            title={eventTitle(event)}
            posterUrl={event.metadata?.posterUrl}
          />
          <div className="host-byline">
            <span>Hosted by</span>
            <strong>
              <span className="host-avatar">{owner ? "Y" : "H"}</span>
              {owner ? "You" : shorten(event.organizer)}
            </strong>
          </div>
          <button
            className="share-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            <Copy size={15} />
            {copied ? "Link copied" : "Copy event link"}
          </button>
          <a
            className="receipt-link"
            href={`${explorer}/address/${event.vault}`}
            target="_blank"
            rel="noreferrer"
          >
            View event on Monadscan <ArrowUpRight size={13} />
          </a>
        </aside>
        <div className="detail-main">
          <div className="event-chips">
            <span>{statusLabel(event)}</span>
            <span>Testnet event</span>
          </div>
          <h1>{eventTitle(event)}</h1>
          <div className="detail-facts">
            <div>
              <CalendarDays size={22} />
              <span>
                <strong>{dateLabel(event.startAt)}</strong>
                <small>
                  {timeLabel(event.startAt)}
                  {event.settleAt ? ` – ${timeLabel(event.settleAt)}` : ""} ·
                  Local time
                </small>
              </span>
            </div>
            <div>
              <MapPin size={22} />
              <span>
                <strong>
                  {event.metadata?.location || "Location to be announced"}
                </strong>
              </span>
            </div>
            <div>
              <Users size={22} />
              <span>
                <strong>
                  {event.participantCount} / {event.maxParticipant} spots
                  committed
                </strong>
                <small>Make a little promise to be there.</small>
              </span>
            </div>
          </div>
          <ReservationPanel event={event} refresh={refresh} />
          <section className="event-description">
            <h2>About this event</h2>
            {event.metadataUnavailable ? (
              <p>
                Event details are temporarily unavailable.{" "}
                <button onClick={refresh}>Try again</button>
              </p>
            ) : (
              <p>
                {event.metadata?.description ||
                  "The host hasn’t added a description yet."}
              </p>
            )}
          </section>
          <section className="commitment-explainer">
            <Ticket size={22} />
            <div>
              <h2>Your commitment comes with you.</h2>
              <p>
                Attend and get your commitment back after settlement. Confirmed
                attendees also share eligible rewards. Missing the event means
                forfeiting your commitment.
              </p>
              <small>
                Testnet tokens have no monetary value. Rewards are variable.
              </small>
            </div>
          </section>
          {owner && <HostPanel event={event} refresh={refresh} />}
        </div>
      </div>
    </main>
  );
}

function ReservationPanel({
  event,
  refresh,
}: {
  event: EventSummary;
  refresh: () => void;
}) {
  const { authenticated } = usePrivy();
  const { session, refresh: refreshSession } = useAccount();
  const { wallets } = useWallets();
  const wallet = wallets.find((wallet) => wallet.walletClientType === "privy");
  const { createWallet } = useCreateWallet();
  const { sendTransaction } = useSendTransaction();
  const [participation, setParticipation] = useState<
    readonly [boolean, boolean, boolean, bigint] | null
  >(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Hash | null>(null);
  const [reload, setReload] = useState(0);
  const key = `commitpass:reservation:${event.vault}:${wallet?.address ?? "guest"}`;
  useEffect(() => {
    setParticipation(null);
    setPending(null);
    try {
      const saved = localStorage.getItem(key);
      if (saved && /^0x[0-9a-fA-F]{64}$/.test(saved)) setPending(saved as Hash);
    } catch {
      /* No persisted transaction is available. */
    }
    if (!wallet) return;
    let active = true;
    void chainClient
      .readContract({
        address: event.vault,
        abi: eventVaultAbi,
        functionName: "participants",
        args: [wallet.address as Address],
      })
      .then((result) => {
        if (active) setParticipation(result);
      })
      .catch(() => {
        if (active)
          setError(
            "Could not read your reservation. Refresh before trying again.",
          );
      });
    return () => {
      active = false;
    };
  }, [event.vault, wallet?.address, key, reload]);
  async function confirm(hash: Hash) {
    setPending(hash);
    localStorage.setItem(key, hash);
    const receipt = await chainClient.waitForTransactionReceipt({
      hash,
      confirmations: 2,
      timeout: 120000,
    });
    localStorage.removeItem(key);
    setPending(null);
    if (receipt.status !== "success")
      throw new Error("The transaction did not complete. Please try again.");
  }
  async function act() {
    if (!wallet || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (pending) {
        await confirm(pending);
        setMessage(
          "Transaction confirmed. Your reservation state has been refreshed.",
        );
        return;
      }
      if (!session)
        throw new Error("Your account is still connecting. Please try again.");
      const known = await chainClient.readContract({
        address: factoryAddress,
        abi: factoryAbi,
        functionName: "isVault",
        args: [event.vault],
      });
      if (!known)
        throw new Error("This event is not recognized by CommitPass.");
      const asset = await chainClient.readContract({
        address: event.vault,
        abi: eventVaultAbi,
        functionName: "ASSET_TOKEN",
      });
      if (asset.toLowerCase() !== assetAddress.toLowerCase())
        throw new Error("This event uses an unsupported asset.");
      await wallet.switchChain(MONAD_TESTNET.chainId);
      const person = await chainClient.readContract({
        address: event.vault,
        abi: eventVaultAbi,
        functionName: "participants",
        args: [wallet.address as Address],
      });
      const settled = await chainClient.readContract({
        address: event.vault,
        abi: eventVaultAbi,
        functionName: "eventSettled",
      });
      if (person[0] && settled && person[1] && !person[2] && person[3] > 0n) {
        await chainClient.simulateContract({
          address: event.vault,
          abi: eventVaultAbi,
          functionName: "claimReward",
          account: wallet.address as Address,
        });
        setMessage("Confirm your claim in your wallet.");
        const tx = await sendTransaction(
          {
            to: event.vault,
            chainId: MONAD_TESTNET.chainId,
            data: encodeFunctionData({
              abi: eventVaultAbi,
              functionName: "claimReward",
            }),
          },
          { address: wallet.address, uiOptions: { showWalletUIs: true } },
        );
        await confirm(tx.hash);
        setMessage("Claim confirmed. Your return is in your wallet.");
        return;
      }
      if (person[0])
        throw new Error("You already have a commitment for this event.");
      const [block, deadline, closed, started, count, capacity, stake] =
        await Promise.all([
          chainClient.getBlock(),
          chainClient.readContract({
            address: event.vault,
            abi: eventVaultAbi,
            functionName: "registrationDeadline",
          }),
          chainClient.readContract({
            address: event.vault,
            abi: eventVaultAbi,
            functionName: "registrationClosed",
          }),
          chainClient.readContract({
            address: event.vault,
            abi: eventVaultAbi,
            functionName: "depositedToYield",
          }),
          chainClient.readContract({
            address: event.vault,
            abi: eventVaultAbi,
            functionName: "getParticipantCount",
          }),
          chainClient.readContract({
            address: event.vault,
            abi: eventVaultAbi,
            functionName: "maxParticipant",
          }),
          chainClient.readContract({
            address: event.vault,
            abi: eventVaultAbi,
            functionName: "stakeAmount",
          }),
        ]);
      if (
        closed ||
        started ||
        settled ||
        block.timestamp >= deadline ||
        count >= capacity
      )
        throw new Error("Registration is closed or the event is full.");
      const balance = await chainClient.readContract({
        address: assetAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet.address as Address],
      });
      if (balance < stake)
        throw new Error(
          "Your wallet needs more mockAUSD test tokens to reserve this spot.",
        );
      // Persist capability is checked before asking the wallet to send a transaction.
      localStorage.setItem(`${key}:ready`, "1");
      localStorage.removeItem(`${key}:ready`);
      const allowance = await chainClient.readContract({
        address: assetAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [wallet.address as Address, event.vault],
      });
      if (allowance < stake) {
        setMessage("Step 1 of 2: approve this event’s commitment amount.");
        const approval = await sendTransaction(
          {
            to: assetAddress,
            chainId: MONAD_TESTNET.chainId,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "approve",
              args: [event.vault, stake],
            }),
          },
          { address: wallet.address, uiOptions: { showWalletUIs: true } },
        );
        await confirm(approval.hash);
      }
      await chainClient.simulateContract({
        address: event.vault,
        abi: eventVaultAbi,
        functionName: "deposit",
        account: wallet.address as Address,
      });
      setMessage("Confirm your commitment in your wallet.");
      const deposit = await sendTransaction(
        {
          to: event.vault,
          chainId: MONAD_TESTNET.chainId,
          data: encodeFunctionData({
            abi: eventVaultAbi,
            functionName: "deposit",
          }),
        },
        { address: wallet.address, uiOptions: { showWalletUIs: true } },
      );
      await confirm(deposit.hash);
      setMessage("Your commitment is confirmed. Your spot is reserved.");
    } catch (error) {
      setError(
        error instanceof Error &&
          !/0x[0-9a-f]{20}|ContractFunction|Execution reverted/i.test(
            error.message,
          )
          ? error.message
          : "Could not complete the transaction. If it was submitted, check its status before trying again.",
      );
    } finally {
      setBusy(false);
      setReload((value) => value + 1);
      refresh();
    }
  }
  const deposited = participation?.[0];
  const claimable =
    participation?.[1] && !participation[2] && participation[3] > 0n;
  const open = statusLabel(event) === "Registration open";
  return (
    <section className="reservation-panel">
      <div className="reservation-panel-heading">
        <strong>{deposited ? "Your reservation" : "Reserve your spot"}</strong>
        <span>
          {amount(event.stakeAmount)} <small>mockAUSD</small>
        </span>
      </div>
      <p>
        {participation?.[2]
          ? "Your return has been claimed."
          : claimable
            ? `${amount(participation![3].toString())} mockAUSD is available to claim.`
            : deposited
              ? "You’re on the list. Your host will confirm your attendance at the event."
              : "A refundable commitment. Show up, check in, and claim it back after settlement."}
      </p>
      {!authenticated ? (
        <Link
          className="button button--dark"
          href={`/signin?next=${encodeURIComponent(`/events/${event.vault}`)}`}
        >
          Sign in to join
          <ArrowUpRight size={16} />
        </Link>
      ) : !wallet ? (
        <button
          className="button button--dark"
          disabled={busy || !session}
          onClick={async () => {
            setBusy(true);
            try {
              await createWallet();
              refreshSession();
            } catch {
              setError("Could not set up your wallet.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Set up your wallet
        </button>
      ) : (
        <button
          className="button button--dark"
          onClick={act}
          disabled={
            busy ||
            (!pending &&
              (!participation || (!claimable && (deposited || !open))))
          }
        >
          {busy
            ? "Please wait…"
            : pending
              ? "Check transaction"
              : claimable
                ? "Claim your return"
                : deposited
                  ? "You’re going"
                  : open
                    ? "Commit & reserve"
                    : "Registration closed"}
          {deposited && !claimable && <Check size={16} />}
        </button>
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
          href={`${explorer}/tx/${pending}`}
          target="_blank"
          rel="noreferrer"
        >
          View transaction ↗
        </a>
      )}
      <small>
        <Clock3 size={13} />
        Registration closes{" "}
        {dateLabel(event.registrationDeadline, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </small>
    </section>
  );
}

function HostPanel({
  event,
  refresh,
}: {
  event: EventSummary;
  refresh: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const [metadata, setMetadata] = useState<EventMetadata>(
    event.metadata ?? {
      title: "",
      description: "",
      location: "",
      posterUrl: "",
    },
  );
  const [participants, setParticipants] = useState<IndexedParticipant[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function loadGuests(after = "") {
    setBusy(true);
    setError("");
    try {
      const token = await getAccessToken();
      const [people, checkIns] = await Promise.all([
        jsonRequest<{ data: IndexedParticipant[]; nextCursor: string | null }>(
          `/api/events/${event.vault}/participants?after=${encodeURIComponent(after)}`,
        ),
        jsonRequest<{ checkIns: { wallet: string }[] }>(
          `/api/events/${event.vault}/check-ins`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      ]);
      setParticipants((current) =>
        after ? [...current, ...people.data] : people.data,
      );
      setCursor(people.nextCursor);
      setChecked(
        checkIns.checkIns.map((record) => record.wallet.toLowerCase()),
      );
      setLoaded(true);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load guests.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="host-tools">
      <h2>Host tools</h2>
      <details>
        <summary>Edit event details</summary>
        <form
          onSubmit={async (form) => {
            form.preventDefault();
            setBusy(true);
            setError("");
            setMessage("");
            try {
              const token = await getAccessToken();
              await jsonRequest(`/api/events/${event.vault}/metadata`, {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(metadata),
              });
              setMessage("Event details saved.");
              refresh();
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Could not save details.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Title
            <input
              value={metadata.title}
              maxLength={120}
              required
              onChange={(e) =>
                setMetadata({ ...metadata, title: e.target.value })
              }
            />
          </label>
          <label>
            Location
            <input
              value={metadata.location}
              maxLength={300}
              onChange={(e) =>
                setMetadata({ ...metadata, location: e.target.value })
              }
            />
          </label>
          <label>
            Description
            <textarea
              rows={5}
              value={metadata.description}
              maxLength={5000}
              onChange={(e) =>
                setMetadata({ ...metadata, description: e.target.value })
              }
            />
          </label>
          <label>
            Cover URL
            <input
              type="url"
              value={metadata.posterUrl}
              maxLength={2048}
              onChange={(e) =>
                setMetadata({ ...metadata, posterUrl: e.target.value })
              }
            />
          </label>
          <button className="button" disabled={busy}>
            Save details
          </button>
        </form>
      </details>
      <details
        onToggle={(e) => {
          if (e.currentTarget.open && !loaded && !busy) void loadGuests();
        }}
      >
        <summary>Guests & check-in</summary>
        <p>Mark a guest present when you confirm they are at the event.</p>
        {participants.map((person) => (
          <div className="guest-checkin" key={person.id}>
            <span>{shorten(person.wallet)}</span>
            <button
              disabled={
                busy ||
                checked.includes(person.wallet.toLowerCase()) ||
                event.status !== "ACTIVE"
              }
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const token = await getAccessToken();
                  await jsonRequest(
                    `/api/events/${event.vault}/check-ins/${person.wallet}`,
                    {
                      method: "PUT",
                      headers: { Authorization: `Bearer ${token}` },
                    },
                  );
                  setChecked((current) => [
                    ...current,
                    person.wallet.toLowerCase(),
                  ]);
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Could not record attendance.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {checked.includes(person.wallet.toLowerCase())
                ? "Checked in"
                : "Check in"}
            </button>
          </div>
        ))}
        {loaded && !participants.length && <p>No committed guests yet.</p>}
        {cursor && (
          <button
            className="button"
            disabled={busy}
            onClick={() => loadGuests(cursor)}
          >
            Load more guests
          </button>
        )}
        <button
          className="auth-text-button"
          disabled={busy}
          onClick={() => loadGuests()}
        >
          {busy ? "Loading…" : "Refresh guests"}
        </button>
      </details>
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
    </section>
  );
}
