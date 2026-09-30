"use client";
import { useEffect, useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { Check, Copy } from "lucide-react";
import { useAccount } from "./account-context";

export function WalletAddress() {
  const { session, connecting, error: accountError } = useAccount();
  const { wallets } = useWallets();
  const verified = session?.wallets ?? [];
  const address =
    verified.find((value) =>
      wallets.some(
        (wallet) =>
          wallet.walletClientType === "privy" &&
          wallet.address.toLowerCase() === value.toLowerCase(),
      ),
    ) ??
    verified[0] ??
    "";
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setCopied("");
    setError("");
  }, [address]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(""), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  if (!address)
    return (
      <p
        className="wallet-address-state"
        role={connecting ? "status" : undefined}
      >
        {connecting
          ? "Loading wallet…"
          : accountError
            ? "Wallet unavailable."
            : "No wallet linked."}
      </p>
    );
  const done = copied === address;
  return (
    <>
      <div className="account-wallet">
        <div className="account-wallet-details">
          <span className="account-wallet-label">Wallet</span>
          <code>{address}</code>
        </div>
        <button
          type="button"
          className="account-wallet-copy"
          aria-label={done ? "Wallet address copied" : "Copy wallet address"}
          title={done ? "Copied" : "Copy address"}
          onClick={async () => {
            setError("");
            try {
              await navigator.clipboard.writeText(address);
              setCopied(address);
            } catch {
              setError("Could not copy. Select the address to copy it.");
            }
          }}
        >
          {done ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Copy size={16} aria-hidden="true" />
          )}
        </button>
        <span className="sr-only" role="status">
          {done ? "Wallet address copied" : ""}
        </span>
      </div>
      {error && (
        <p className="wallet-address-state" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
