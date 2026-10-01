"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  type EventSummary,
} from "@commitpass/shared";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
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
import { EventVaultCard } from "./event-vault-card";
import { EventLocation } from "./event-location";
import { usePageAppearance } from "./page-theme";
import { usePreferences } from "./preferences";
import { utcOffset } from "@/lib/display-time";
import { LoadError } from "./event-list";
import { EventPass } from "./event-pass";
import { HostManagement } from "./host-management";
import { useEventState, type LiveEventState } from "./use-event-state";
import { isLocal, runtimeStorageKey } from "@/lib/runtime-network";

export function EventDetail({
  vault,
  manage = false,
}: {
  vault: string;
  manage?: boolean;
}) {
  const { timezone } = usePreferences();
  const [indexedEvent, setEvent] = useState<EventSummary | null>(null);
  const live = useEventState(vault as Address);
  const asideRef = useRef<HTMLElement>(null);
  const event =
    indexedEvent && live.value
      ? {
          ...indexedEvent,
          owner: live.value.owner,
          status: live.value.status,
          registrationClosed: live.value.closed,
          participantCount: Number(live.value.count),
          stakeAmount: live.value.stake.toString(),
          maxParticipant: live.value.capacity.toString(),
          registrationDeadline: live.value.deadline.toString(),
          startAt: live.value.start.toString(),
          settleAt: live.value.settleAt.toString(),
        }
      : indexedEvent;
  usePageAppearance(event?.metadata?.appearance);
  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;
    const position = () =>
      aside.style.setProperty(
        "--aside-sticky-top",
        `${Math.min(24, window.innerHeight - aside.getBoundingClientRect().height - 24)}px`,
      );
    position();
    const observer = new ResizeObserver(position);
    observer.observe(aside);
    window.addEventListener("resize", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
    };
  }, [event?.vault]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => {
    setAttempt((value) => value + 1);
    live.refresh();
  }, [live.refresh]);
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
    const timer = setTimeout(() => setAttempt((value) => value + 1), 20000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [vault, attempt, session?.id]);
  if (loading && !event)
    return (
      <main className="workspace-content" id="workspace-main">
        <div className="detail-skeleton" aria-label="Loading event" />
      </main>
    );
  if (!event)
    return (
      <main className="workspace-content" id="workspace-main">
        <LoadError
          message={error || "This event has not been indexed yet."}
          retry={refresh}
        />
      </main>
    );
  const owner =
    !live.error &&
    !!live.value &&
    session?.wallets.some(
      (wallet) => wallet.toLowerCase() === live.value?.owner.toLowerCase(),
    );
  const startOffset = utcOffset(
    new Date(Number(event.startAt) * 1000),
    timezone,
  );
  const endOffset = event.settleAt
    ? utcOffset(new Date(Number(event.settleAt) * 1000), timezone)
    : startOffset;
  return (
    <main className="workspace-content detail-workspace" id="workspace-main">
      <div className="detail-grid">
        <aside className="detail-aside" ref={asideRef}>
          <EventCover
            title={eventTitle(event)}
            posterUrl={event.metadata?.posterUrl}
          />
          <div className="host-byline">
            <span>Hosted by</span>
            <strong>
              <span className="host-avatar">
                {(
                  event.metadata?.organizerName ||
                  (owner && session?.name) ||
                  "Organizer"
                )
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
              {event.metadata?.organizerName ||
                (owner && session?.name) ||
                "Organizer"}
            </strong>
          </div>
          <EventVaultCard event={indexedEvent ?? event} />
        </aside>
        <div className="detail-main">
          <div className="event-chips detail-status">
            <span>{statusLabel(event)}</span>
          </div>
          <h1>{eventTitle(event)}</h1>
          <div className="detail-facts">
            <div>
              <span className="detail-fact-icon">
                <CalendarDays size={20} />
              </span>
              <span>
                <strong>
                  {dateLabel(event.startAt, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    timeZone: timezone,
                  })}
                </strong>
                <small>
                  {timeLabel(event.startAt, timezone)}
                  {startOffset !== endOffset ? ` ${startOffset}` : ""}
                  {event.settleAt
                    ? ` – ${timeLabel(event.settleAt, timezone)}${startOffset !== endOffset ? ` ${endOffset}` : ""}`
                    : ""}{" "}
                  {startOffset === endOffset ? `· ${startOffset} ` : ""}·{" "}
                  {timezone.replaceAll("_", " ")}
                </small>
              </span>
            </div>
            <div>
              <span className="detail-fact-icon">
                <MapPin size={20} />
              </span>
              <span>
                <strong>
                  {event.metadata?.location || "Location to be announced"}
                </strong>
              </span>
            </div>
            <div>
              <span className="detail-fact-icon">
                <Users size={20} />
              </span>
              <span>
                <strong>
                  {event.participantCount} / {event.maxParticipant} spots
                  committed
                </strong>
              </span>
            </div>
          </div>
          {(error || live.error) && (
            <p className="form-error" role="alert">
              {live.error ||
                "Event details could not refresh. Showing the last available details."}{" "}
              <button className="auth-text-button" onClick={refresh}>
                Reconnect
              </button>
            </p>
          )}
          {manage ? (
            <HostManagement
              event={event}
              live={live.error ? null : live.value}
              owner={!!owner}
              refresh={refresh}
            />
          ) : (
            <>
              {owner ? (
                <OrganizerEventPanel event={event} />
              ) : (
                <ReservationPanel
                  event={event}
                  refresh={refresh}
                  live={live.error ? null : live.value}
                />
              )}
            </>
          )}
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
          <EventLocation location={event.metadata?.location || ""} />
        </div>
      </div>
    </main>
  );
}

function OrganizerEventPanel({ event }: { event: EventSummary }) {
  const { timezone } = usePreferences();
  return (
    <section
      className="reservation-panel organizer-event-panel"
      aria-label="Organizer event summary"
    >
      <div className="reservation-panel-heading">
        <strong>Your event</strong>
        <span className="organizer-label">Organizer</span>
      </div>
      <p>
        Manage your guest list, confirm attendance, and keep your event on
        track.
      </p>
      <dl className="organizer-event-stats">
        <div>
          <dt>Guests</dt>
          <dd>
            {event.participantCount}
            <small> / {event.maxParticipant}</small>
          </dd>
        </div>
        <div>
          <dt>Commitment per guest</dt>
          <dd>
            {amount(event.stakeAmount)}
            <small> USDC</small>
          </dd>
        </div>
      </dl>
      <Link
        className="button button--dark"
        href={`/events/${event.vault}/manage`}
      >
        Manage event
        <ArrowUpRight size={16} />
      </Link>
      <small>
        <Clock3 size={13} />
        Registration closes{" "}
        {dateLabel(event.registrationDeadline, {
          month: "short",
          day: "numeric",
          timeZone: timezone,
        })}{" "}
        · {timeLabel(event.registrationDeadline, timezone)}{" "}
        {utcOffset(
          new Date(Number(event.registrationDeadline) * 1000),
          timezone,
        )}
      </small>
    </section>
  );
}

function ReservationPanel({
  event,
  refresh,
  live,
}: {
  event: EventSummary;
  refresh: () => void;
  live: LiveEventState | null;
}) {
  const { authenticated } = usePrivy();
  const { timezone } = usePreferences();
  const {
    session,
    error: sessionError,
    refresh: refreshSession,
  } = useAccount();
  const { wallets } = useWallets();
  const wallet = wallets.find((wallet) => wallet.walletClientType === "privy");
  const { createWallet } = useCreateWallet();
  const { sendTransaction } = useSendTransaction();
  const [person, setPerson] = useState<{
    key: string;
    value: readonly [boolean, boolean, boolean, bigint];
  } | null>(null);
  const [readError, setReadError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Hash | null>(null);
  const [reload, setReload] = useState(0);
  const key = runtimeStorageKey(
    `commitpass:reservation:${event.vault}:${wallet?.address ?? "guest"}`,
  );
  const participation = person?.key === key ? person.value : null;
  useEffect(() => {
    setPending(null);
    setError("");
    setMessage("");
    try {
      const saved = localStorage.getItem(key);
      if (saved && /^0x[0-9a-fA-F]{64}$/.test(saved)) setPending(saved as Hash);
    } catch {
      /* No persisted transaction is available. */
    }
  }, [key]);
  useEffect(() => {
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
        if (active) {
          setPerson({ key, value: result });
          setReadError("");
        }
      })
      .catch(() => {
        if (active)
          setReadError(
            "Could not read your reservation. Refresh before trying again.",
          );
      });
    return () => {
      active = false;
    };
  }, [event.vault, wallet?.address, key, reload, live?.blockNumber]);
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
    if (!wallet || busy || !live) return;
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
        functionName: "USDC_TOKEN",
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
      if (person[0] && settled && !person[2] && person[3] > 0n) {
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
          "Your wallet needs more USDC test tokens to reserve this spot.",
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
    !!live?.settled &&
    participation?.[0] &&
    !participation[2] &&
    participation[3] > 0n;
  const open =
    !!live &&
    !live.closed &&
    !live.started &&
    !live.settled &&
    live.timestamp < live.deadline &&
    live.count < live.capacity;
  return (
    <>
      {deposited && wallet && (
        <EventPass
          event={event}
          wallet={wallet.address}
          claimed={!!participation?.[2]}
          attended={!!participation?.[1]}
          settled={!!live?.settled}
          refund={live?.outcome === 2 || live?.outcome === 3}
        />
      )}
      <section className="reservation-panel">
        <div className="reservation-panel-heading">
          <strong>
            {deposited ? "Your reservation" : "Reserve your spot"}
          </strong>
          <span>
            {amount(event.stakeAmount)} <small>USDC</small>
          </span>
        </div>
        <p>
          {!authenticated
            ? "Sign in to join this event and reserve your spot."
            : participation?.[2]
              ? "Your return has been claimed."
              : claimable
                ? `${amount(participation![3].toString())} USDC is available to claim.`
                : deposited
                  ? live?.settled && live?.outcome === 1
                    ? "No attendance was confirmed. Your commitment was forfeited: 50% to CommitPass and 50% to attendees."
                    : "You’re on the list. Your host will confirm your attendance at the event."
                  : "A refundable commitment. Show up, check in, and collect your return after the event ends."}
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
              !!readError ||
              !live ||
              !session ||
              (!pending &&
                (!participation || (!claimable && (deposited || !open))))
            }
          >
            {busy
              ? "Please wait…"
              : pending
                ? "Check transaction"
                : participation?.[2]
                  ? "Return claimed"
                  : claimable
                    ? live?.outcome === 2 || live?.outcome === 3
                      ? "Claim refund"
                      : "Claim your return"
                    : deposited
                      ? live?.settled
                        ? "No claim available"
                        : "You’re going"
                      : open
                        ? "Commit & reserve"
                        : "Registration closed"}
            {deposited && !claimable && !live?.settled && <Check size={16} />}
          </button>
        )}
        {readError && (
          <p className="form-error" role="alert">
            {readError}{" "}
            <button
              className="auth-text-button"
              onClick={() => setReload((n) => n + 1)}
            >
              Retry
            </button>
          </p>
        )}
        {sessionError && (
          <p className="form-error">
            {sessionError}{" "}
            <button onClick={refreshSession}>Reconnect account</button>
          </p>
        )}
        {!live && (
          <p className="field-note">Connecting to live event status…</p>
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
            timeZone: timezone,
            hourCycle: "h23",
          })}{" "}
          {utcOffset(
            new Date(Number(event.registrationDeadline) * 1000),
            timezone,
          )}
        </small>
      </section>
    </>
  );
}
