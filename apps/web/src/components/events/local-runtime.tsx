"use client";
import { useState } from "react";
import { useCreateWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { isLocal, localRunId } from "@/lib/runtime-network";
import { jsonRequest } from "@/lib/events";
import { useAccount } from "./account-context";

export function LocalRuntimeNotice() {
  const { authenticated, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { session, refresh } = useAccount();
  const wallet = wallets.find((value) => value.walletClientType === "privy");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!isLocal) return null;
  return (
    <aside className="local-runtime-notice" aria-label="Local development mode">
      <span>
        <strong>Local mode</strong> Anvil + CRE simulation · disposable test
        funds <small>Run {localRunId.slice(0, 8)}</small>
      </span>
      {authenticated && (
        <button
          disabled={busy || !session}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setMessage("");
            try {
              if (!wallet) {
                await createWallet();
                refresh();
                setMessage(
                  "Wallet ready. Click Get local test funds to fund it.",
                );
                return;
              }
              const token = await getAccessToken();
              if (!token) throw new Error("Please sign in again.");
              await jsonRequest("/api/local/fund", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ wallet: wallet.address }),
              });
              setMessage(
                "Local wallet funded: 10 MON and 1,000 USDC (once per run).",
              );
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Could not fund the local wallet.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy
            ? "Preparing…"
            : wallet
              ? "Get local test funds"
              : "Set up local wallet"}
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </aside>
  );
}
